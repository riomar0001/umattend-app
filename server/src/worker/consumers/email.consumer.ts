/**
 * Consumer for `umattend-email`, replacing the BullMQ email worker.
 *
 * The old worker throttled itself to one send per 10s via BullMQ's `limiter`.
 * The equivalent here is queue configuration — `max_batch_size: 1` plus a
 * modest `max_concurrency` in wrangler.jsonc — rather than sleeping inside the
 * consumer, since Workers bill for wall-clock time spent waiting.
 */

import { sendMail } from '../../configs/smtp.config';
import type { EmailMessage } from '../messages';
import { retryOrDeadLetter } from '../deadLetter';

/** Exponential-ish backoff, mirroring BullMQ's 2s base delay. */
const retryDelay = (attempts: number): number =>
  Math.min(2 ** attempts, 900);

/** Mirrors `max_retries` on the umattend-email consumer in wrangler.jsonc. */
const MAX_RETRIES = 3;

export const consumeEmailBatch = async (
  batch: MessageBatch<EmailMessage>
): Promise<void> => {
  for (const message of batch.messages) {
    const { to, subject, html } = message.body;

    try {
      await sendMail({ to, subject, html });
      console.log(`Email sent to ${to}`);
      message.ack();
    } catch (error) {
      console.error(
        `Failed to send email to ${to} (attempt ${message.attempts}):`,
        error
      );
      await retryOrDeadLetter(
        message,
        batch.queue,
        MAX_RETRIES,
        error,
        retryDelay(message.attempts)
      );
    }
  }
};
