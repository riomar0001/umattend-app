/**
 * Explicit dead-lettering, so a failed job records *why* it failed.
 *
 * Cloudflare's own dead-lettering copies the message body to the DLQ verbatim.
 * It carries no error, no origin queue, and resets the attempt counter — so a
 * job that lands there through the platform path is just a payload, and the
 * admin panel has nothing to show beyond "this failed". The error only ever
 * exists inside the consumer's catch block.
 *
 * So on the final attempt the consumer sends its own enriched copy to the DLQ
 * and acks the original, rather than letting the retry budget lapse.
 *
 * The `dead_letter_queue` settings in wrangler.jsonc are deliberately kept as a
 * backstop: they still catch the failures this path cannot see — a CPU timeout,
 * an isolate crash, or a throw before the try block — where no catch ever runs.
 * Those still arrive verbatim, and `reason` is simply absent for them.
 */

import { bindings } from './runtime';

/** Marker distinguishing an enriched dead letter from a verbatim platform one. */
export const DEAD_LETTER_MARKER = '__dead_letter';

export interface DeadLetterEnvelope<T = unknown> {
  [DEAD_LETTER_MARKER]: 1;
  /** Queue the job was originally consumed from. */
  queue: string;
  error: string;
  /** Deliveries made before giving up, from the source queue's counter. */
  attempts: number;
  failed_at: string;
  /** The original message body, untouched, so a retry can re-send it as-is. */
  body: T;
}

/** Long enough to identify the failure, short enough not to bloat the queue. */
const ERROR_LIMIT = 800;

const describeError = (error: unknown): string => {
  const text =
    error instanceof Error
      ? `${error.name}: ${error.message}${error.stack ? `\n${error.stack}` : ''}`
      : String(error);

  return text.length > ERROR_LIMIT
    ? `${text.slice(0, ERROR_LIMIT)}… (truncated)`
    : text;
};

export const isDeadLetterEnvelope = (
  value: unknown
): value is DeadLetterEnvelope =>
  typeof value === 'object' &&
  value !== null &&
  (value as Record<string, unknown>)[DEAD_LETTER_MARKER] === 1;

/**
 * Retry, or give up and dead-letter with the reason attached.
 *
 * `maxRetries` must mirror the queue's `max_retries` in wrangler.jsonc. If the
 * two drift, the failure mode is mild and one-directional: a value that is too
 * low gives up an attempt early, and one that is too high hands the message to
 * the platform's dead-letter path instead, which is exactly today's behaviour —
 * the job is still preserved, just without its error.
 *
 * `message.attempts` starts at 1 on the first delivery, so a queue configured
 * with `max_retries: n` delivers a message up to n + 1 times. The comparison is
 * `<=` for that reason: `<` dead-lettered on delivery n and silently forfeited
 * the last retry the queue was configured to allow.
 */
export const retryOrDeadLetter = async <T>(
  message: Message<T>,
  originQueue: string,
  maxRetries: number,
  error: unknown,
  delaySeconds: number
): Promise<void> => {
  if (message.attempts <= maxRetries) {
    message.retry({ delaySeconds });
    return;
  }

  const envelope: DeadLetterEnvelope<T> = {
    [DEAD_LETTER_MARKER]: 1,
    queue: originQueue,
    error: describeError(error),
    attempts: message.attempts,
    failed_at: new Date().toISOString(),
    body: message.body,
  };

  try {
    await bindings().DLQ.send(envelope);
    message.ack();
  } catch (sendError) {
    // Never lose the job because the bookkeeping failed. Retrying hands it back
    // to the platform, which will dead-letter it verbatim once the budget runs
    // out — the same outcome as before, minus the error text.
    console.error(
      `Could not write enriched dead letter for ${originQueue}; falling back to platform dead-lettering:`,
      sendError
    );
    message.retry({ delaySeconds });
  }
};
