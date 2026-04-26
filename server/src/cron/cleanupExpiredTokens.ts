import cron from 'node-cron';
import { setTimeout as sleep } from 'timers/promises';
import prisma from '../configs/prisma.config';

const CLEANUP_BATCH_SIZE = 500;
const CLEANUP_BATCH_PAUSE_MS = 100;

let consecutiveFailures = 0;

// Runs every 12 hours at minute 0
cron.schedule('0 */12 * * *', async () => {
  const startedAt = Date.now();
  let totalRevoked = 0;

  console.log(
    JSON.stringify({
      level: 'info',
      job: 'cleanupExpiredTokens',
      event: 'start',
      timestamp: new Date().toISOString(),
    })
  );

  try {
    // Process in chunks so we never hold locks on large swaths of the
    // refresh_token table at once — login/refresh/logout share this table.
    for (;;) {
      const expired = await prisma.refresh_token.findMany({
        where: {
          is_active: true,
          expires_at: { lt: new Date() },
        },
        select: { id: true },
        take: CLEANUP_BATCH_SIZE,
      });

      if (expired.length === 0) {
        break;
      }

      const result = await prisma.refresh_token.updateMany({
        where: { id: { in: expired.map((t) => t.id) } },
        data: { is_active: false, revoked_at: new Date() },
      });

      totalRevoked += result.count;

      if (expired.length < CLEANUP_BATCH_SIZE) {
        break;
      }

      await sleep(CLEANUP_BATCH_PAUSE_MS);
    }

    consecutiveFailures = 0;

    console.log(
      JSON.stringify({
        level: 'info',
        job: 'cleanupExpiredTokens',
        event: 'success',
        revoked: totalRevoked,
        durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (error) {
    consecutiveFailures += 1;

    console.error(
      JSON.stringify({
        level: 'error',
        job: 'cleanupExpiredTokens',
        event: 'failure',
        consecutiveFailures,
        revokedBeforeFailure: totalRevoked,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      })
    );

    if (consecutiveFailures >= 2) {
      console.error(
        JSON.stringify({
          level: 'critical',
          job: 'cleanupExpiredTokens',
          event: 'sustained_failure',
          consecutiveFailures,
          message: 'Token cleanup has failed multiple consecutive runs',
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
});
