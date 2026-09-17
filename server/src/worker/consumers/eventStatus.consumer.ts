/**
 * Consumer for `umattend-event-status`, replacing the BullMQ start/end workers.
 *
 * Cloudflare Queues cannot remove or reschedule an already-enqueued message, so
 * a message is only a hint that an event *may* be due. The authority is the row
 * itself: the consumer reloads the event, and
 *
 *   - flips the flag if it is genuinely due,
 *   - re-enqueues for the new time if the event was edited to a later slot,
 *   - re-enqueues another hop if the due time is more than 24h out (the cap on
 *     `delaySeconds`),
 *   - drops the message if the event was deleted or already flipped.
 *
 * This also makes redelivery harmless, which matters because Queues guarantees
 * at-least-once delivery.
 */

import prisma from '../../configs/prisma.config';
import type { Env } from '../env';
import { delayUntil, type EventStatusMessage } from '../messages';
import { doneDueAt, startDueAt } from '../eventStatus';
import { retryOrDeadLetter } from '../deadLetter';

/** Mirrors `max_retries` on the umattend-event-status consumer in wrangler.jsonc. */
const MAX_RETRIES = 5;

const handle = async (
  body: EventStatusMessage,
  env: Env
): Promise<void> => {
  const { type, event_id } = body;

  const event = await prisma.events.findUnique({
    where: { id: event_id },
    select: {
      id: true,
      all_day: true,
      start_time: true,
      end_time: true,
      created_at: true,
      is_started: true,
      is_done: true,
    },
  });

  if (!event) {
    console.log(`[${type}] event ${event_id} no longer exists; dropping.`);
    return;
  }

  const isStart = type === 'event-start';

  if (isStart ? event.is_started : event.is_done) {
    return;
  }

  const dueAt = isStart ? startDueAt(event) : doneDueAt(event);

  if (!dueAt) {
    console.warn(
      `[${type}] event ${event_id} has no ${isStart ? 'start' : 'end'} time; dropping.`
    );
    return;
  }

  if (dueAt.getTime() > Date.now()) {
    // Either a >24h hop, or the event moved later since this was enqueued.
    const delaySeconds = delayUntil(dueAt);
    await env.EVENT_STATUS_QUEUE.send(body, { delaySeconds });
    console.log(
      `[${type}] event ${event_id} not due until ${dueAt.toISOString()}; re-enqueued in ${delaySeconds}s.`
    );
    return;
  }

  // Filtered on the current flag so a concurrent delivery is a no-op rather
  // than a redundant write.
  const { count } = isStart
    ? await prisma.events.updateMany({
        where: { id: event_id, is_started: false },
        data: { is_started: true },
      })
    : await prisma.events.updateMany({
        where: { id: event_id, is_done: false },
        data: { is_done: true },
      });

  if (count > 0) {
    console.log(
      `Event ${event_id} marked as ${isStart ? 'started' : 'done'}.`
    );
  }
};

export const consumeEventStatusBatch = async (
  batch: MessageBatch<EventStatusMessage>,
  env: Env
): Promise<void> => {
  for (const message of batch.messages) {
    try {
      await handle(message.body, env);
      message.ack();
    } catch (error) {
      console.error(
        `[${message.body?.type}] failed for event ${message.body?.event_id} (attempt ${message.attempts}):`,
        error
      );
      await retryOrDeadLetter(
        message,
        batch.queue,
        MAX_RETRIES,
        error,
        Math.min(60 * message.attempts, 900)
      );
    }
  }
};
