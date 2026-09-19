/**
 * Consumer for `umattend-email`, replacing the BullMQ email worker.
 *
 * The whole batch goes out over ONE authenticated SMTP session, spaced by
 * `MAIL_SEND_INTERVAL_MS` (see smtp.config). The previous shape — one message
 * per invocation, one connection per message — meant one Gmail login per email,
 * and a mass check-out of a few dozen attendees reliably earned
 * "454-4.7.0 Too many login attempts, please try again later", after which
 * every subsequent send failed authentication until Gmail relented.
 *
 * So `max_batch_size` in wrangler.jsonc is now the number of emails per login,
 * and `max_concurrency: 1` keeps two batches from logging in at once. The
 * pause between messages costs wall-clock but almost no CPU, which is what
 * Workers bills for.
 */

import { sendMails } from '../../configs/smtp.config';
import type { EmailMessage } from '../messages';
import { retryOrDeadLetter } from '../deadLetter';

/**
 * Gmail's throttle is measured in minutes, not seconds — the old
 * `2 ** attempts` schedule (2s, 4s, 8s) retried well inside the penalty window
 * and simply burned the retry budget. Throttle responses get their own, much
 * longer ladder; everything else keeps the original fast backoff.
 */
const THROTTLE_RETRY_SECONDS = 600;
const MAX_RETRY_SECONDS = 3600;

/** 454/421 with a 4.7.x enhanced code is the provider saying "slow down". */
const isThrottleError = (error: unknown): boolean => {
  const text = error instanceof Error ? error.message : String(error);
  return /too many login attempts|\b4\.7\.\d+\b|\b(?:421|450|451|454)\b/i.test(
    text
  );
};

const retryDelay = (attempts: number, error: unknown): number =>
  isThrottleError(error)
    ? Math.min(THROTTLE_RETRY_SECONDS * attempts, MAX_RETRY_SECONDS)
    : Math.min(2 ** attempts, 900);

/** Mirrors `max_retries` on the umattend-email consumer in wrangler.jsonc. */
const MAX_RETRIES = 3;

export const consumeEmailBatch = async (
  batch: MessageBatch<EmailMessage>
): Promise<void> => {
  const messages = batch.messages;
  if (messages.length === 0) {
    return;
  }

  const mails = messages.map(({ body }) => ({
    to: body.to,
    subject: body.subject,
    html: body.html,
  }));

  let results;
  try {
    results = await sendMails(mails);
  } catch (error) {
    // Connect or AUTH failed, so nothing in this batch was sent. Hand every
    // message back with the same delay rather than hammering the login again.
    console.error(
      `SMTP session failed for a batch of ${messages.length} (attempt ${messages[0].attempts}):`,
      error
    );

    for (const message of messages) {
      await retryOrDeadLetter(
        message,
        batch.queue,
        MAX_RETRIES,
        error,
        retryDelay(message.attempts, error)
      );
    }
    return;
  }

  for (const [index, message] of messages.entries()) {
    const result = results[index];

    if (result?.ok) {
      console.log(`Email sent to ${message.body.to}`);
      message.ack();
      continue;
    }

    const error = result?.error ?? new Error('No SMTP result for message');
    console.error(
      `Failed to send email to ${message.body.to} (attempt ${message.attempts}):`,
      error
    );
    await retryOrDeadLetter(
      message,
      batch.queue,
      MAX_RETRIES,
      error,
      retryDelay(message.attempts, error)
    );
  }
};
