/**
 * Worker entry point.
 *
 * Three handlers replace what used to be one long-lived Node process:
 *
 *   fetch()     — the Express app (see ./http)
 *   queue()     — Cloudflare Queues consumer, replacing the BullMQ workers
 *   scheduled() — Cron Triggers, replacing node-cron
 *
 * Every handler calls `seedRuntime(env)` first so that bindings and
 * `process.env` are in place before any application module is imported.
 */

import type { Env } from './env';
import { seedRuntime } from './runtime';
import { httpHandler } from './http';
import type { EmailMessage, EventStatusMessage } from './messages';
import { consumeEmailBatch } from './consumers/email.consumer';
import { consumeEventStatusBatch } from './consumers/eventStatus.consumer';
import { runScheduled } from './scheduled';

export { EphemeralStore } from './ephemeralStore.do';
export { RateLimiterStore } from './rateLimiter.do';

type QueueMessage = EmailMessage | EventStatusMessage;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    seedRuntime(env);
    const handler = await httpHandler();
    return handler.fetch(request, env, ctx);
  },

  async queue(
    batch: MessageBatch<QueueMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    seedRuntime(env);

    switch (batch.queue) {
      case 'umattend-email':
      case 'umattend-email-staging':
        await consumeEmailBatch(batch as MessageBatch<EmailMessage>);
        return;

      case 'umattend-event-status':
      case 'umattend-event-status-staging':
        await consumeEventStatusBatch(
          batch as MessageBatch<EventStatusMessage>,
          env
        );
        return;

      default:
        // An unrecognised queue is a config error, not a message error —
        // retrying would loop forever, so acknowledge and make it loud.
        console.error(
          `No consumer registered for queue "${batch.queue}"; acking ${batch.messages.length} message(s).`
        );
        batch.ackAll();
    }

    void ctx;
  },

  async scheduled(
    event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    seedRuntime(env);
    ctx.waitUntil(runScheduled(event.cron, env));
  },
};
