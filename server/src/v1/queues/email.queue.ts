/**
 * Email queue producer.
 *
 * Backed by Cloudflare Queues instead of BullMQ. The `.add()` signature is kept
 * so callers (`email.service.ts`) are unchanged; the consumer lives in
 * `src/worker/consumers/email.consumer.ts`.
 *
 * Retry/backoff and dead-lettering are queue configuration now — see the
 * `umattend-email` consumer block in wrangler.jsonc — rather than per-job
 * options.
 */

import { bindings } from '../../worker/runtime';
import type { EmailJob } from '../interface/email';

interface AddOptions {
  /** Accepted for call-site compatibility; Cloudflare Queues has no job ids. */
  jobId?: string;
  delay?: number;
}

export const emailQueue = {
  async add(
    _name: string,
    data: EmailJob,
    options: AddOptions = {}
  ): Promise<void> {
    const delaySeconds = options.delay
      ? Math.min(Math.ceil(options.delay / 1000), 86_400)
      : 0;

    await bindings().EMAIL_QUEUE.send(
      { type: 'send-email', ...data },
      { delaySeconds }
    );
  },
};

export default emailQueue;
