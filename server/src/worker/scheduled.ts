/**
 * Cron Trigger handlers, replacing `node-cron` (which needed a process that
 * stays alive — something a Worker does not have).
 *
 * Schedules are declared in wrangler.jsonc and dispatched here by expression.
 */

import prisma from '../configs/prisma.config';
import type { Env } from './env';
import { doneDueAt, startDueAt } from './eventStatus';

// Was the twice-daily node-cron job in src/cron/cleanupExpiredTokens.ts.
const cleanupExpiredTokens = async (): Promise<void> => {
  console.log('Running expired token cleanup...');

  const revoked = await prisma.refresh_token.updateMany({
    where: {
      expires_at: { lt: new Date() },
      is_active: true,
    },
    data: {
      is_active: false,
      revoked_at: new Date(),
    },
  });

  console.log(`Cleaned up ${revoked.count} expired tokens.`);
};

/**
 * Safety net for the event-status queue.
 *
 * Queue messages are durable, but they are not the only source of truth — an
 * event created before this Worker was deployed, or one whose message was
 * dropped after exhausting retries, would otherwise never flip. This sweep
 * costs two indexed queries and closes that gap.
 */
const reconcileEventStatus = async (): Promise<void> => {
  const now = new Date();

  const candidates = await prisma.events.findMany({
    where: { is_done: false },
    select: {
      id: true,
      all_day: true,
      start_time: true,
      end_time: true,
      created_at: true,
      is_started: true,
      is_done: true,
    },
    orderBy: { created_at: 'asc' },
    take: 500,
  });

  const toStart: string[] = [];
  const toFinish: string[] = [];

  for (const event of candidates) {
    const startAt = startDueAt(event);
    if (!event.is_started && startAt && startAt <= now) {
      toStart.push(event.id);
    }

    const doneAt = doneDueAt(event);
    if (doneAt && doneAt <= now) {
      toFinish.push(event.id);
    }
  }

  if (toStart.length > 0) {
    await prisma.events.updateMany({
      where: { id: { in: toStart }, is_started: false },
      data: { is_started: true },
    });
  }

  if (toFinish.length > 0) {
    await prisma.events.updateMany({
      where: { id: { in: toFinish }, is_done: false },
      data: { is_done: true },
    });
  }

  if (toStart.length || toFinish.length) {
    console.log(
      `Reconciled event status: ${toStart.length} started, ${toFinish.length} done.`
    );
  }
};

export const runScheduled = async (cron: string, env: Env): Promise<void> => {
  void env;

  try {
    switch (cron) {
      case '0 */12 * * *':
        await cleanupExpiredTokens();
        return;

      case '*/15 * * * *':
        await reconcileEventStatus();
        return;

      default:
        console.warn(`No handler registered for cron expression "${cron}".`);
    }
  } catch (error) {
    // Throwing here only marks the cron invocation failed; log with context so
    // it is findable in `wrangler tail`.
    console.error(`Scheduled task "${cron}" failed:`, error);
    throw error;
  }
};
