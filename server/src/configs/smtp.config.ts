/**
 * SMTP transport for Workers.
 *
 * nodemailer cannot run here — it reaches for `net`/`tls` sockets that workerd
 * does not provide. `worker-mailer` speaks SMTP over Cloudflare's `connect()`
 * API instead.
 *
 * Cloudflare blocks outbound port 25, so use a submission port:
 *
 *   MAIL_PORT=587, MAIL_SECURE=false  -> plaintext connect, upgraded by STARTTLS
 *   MAIL_PORT=465, MAIL_SECURE=true   -> TLS from the first byte
 *
 * Submission ports always require TLS, so STARTTLS is requested whenever the
 * connection did not start out encrypted. Without it Gmail rejects the login
 * with "530 Must issue a STARTTLS command first".
 *
 * Sending happens only from the queue consumer, never on the request path.
 *
 * ---
 *
 * One login per BATCH, not per message. Gmail counts logins, not mail: a run of
 * one-message-one-connection sends earns "454-4.7.0 Too many login attempts,
 * please try again later" and then refuses to authenticate at all for a while.
 * A mass check-out queues one email per attendee, which is exactly the shape
 * that trips it. `sendMails` therefore authenticates once and reuses the
 * session, pausing `sendIntervalMs` between messages so the send rate stays
 * modest too.
 */

import { WorkerMailer } from 'worker-mailer';
import { getSmtpConfig } from '@/constants/smtp.constants';

export interface OutgoingMail {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

/** Per-message outcome, positionally matching the input array. */
export type MailResult =
  | { ok: true }
  | {
      ok: false;
      error: unknown;
    };

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ceiling on a single send.
 *
 * worker-mailer runs a dequeue loop over the session and resolves each send
 * when its turn completes. If that loop exits — it closes the session when the
 * RSET after a rejected message fails — anything still queued is never
 * dequeued and its promise never settles. Without this the consumer would hang
 * until the Worker itself timed out, taking the whole batch with it. Comfortably
 * above worker-mailer's own 30s response timeout, so a send that is merely slow
 * still fails with the server's actual error.
 */
const SEND_TIMEOUT_MS = 45_000;

class SendTimeoutError extends Error {
  constructor(ms: number) {
    super(`Timed out after ${ms}ms waiting for the SMTP session to send`);
    this.name = 'SendTimeoutError';
  }
}

const withTimeout = async (
  promise: Promise<void>,
  ms: number
): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SendTimeoutError(ms)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Send a batch over a single authenticated connection.
 *
 * A message that the server rejects does not abort the batch — worker-mailer
 * issues RSET and keeps the session usable — so the failure is captured per
 * message and the caller decides what to retry. A failure to *connect* or
 * authenticate is thrown instead: nothing was sent, and the whole batch has to
 * be retried later.
 */
export const sendMails = async (
  mails: OutgoingMail[]
): Promise<MailResult[]> => {
  if (mails.length === 0) {
    return [];
  }

  // Resolved per call rather than at module scope: this module is in the
  // Worker's static graph (queue consumer -> smtp.config), and Cloudflare
  // evaluates that graph at upload time, before any env is available.
  const config = getSmtpConfig();

  const from = config.fromName
    ? { name: config.fromName, email: config.from }
    : config.from;

  const mailer = await WorkerMailer.connect({
    host: config.host,
    port: config.port,
    secure: config.secure,
    startTls: !config.secure,
    credentials: { username: config.user, password: config.pass },
    // Gmail advertises both; 'login' is the one it actually prefers.
    authType: ['plain', 'login'],
  });

  const results: MailResult[] = [];

  try {
    for (const [index, mail] of mails.entries()) {
      // Between messages only — no reason to hold the connection open after the
      // last one, and the connection is closed immediately below.
      if (index > 0 && config.sendIntervalMs > 0) {
        await sleep(config.sendIntervalMs);
      }

      try {
        await withTimeout(
          mailer.send({
            from,
            to: mail.to,
            subject: mail.subject,
            text: mail.text,
            html: mail.html,
          }),
          SEND_TIMEOUT_MS
        );
        results.push({ ok: true });
      } catch (error) {
        results.push({ ok: false, error });

        if (error instanceof SendTimeoutError) {
          // The session stopped dequeuing, so every remaining send would stall
          // for the full timeout too. Fail them now and let the queue redeliver
          // them on a fresh connection.
          const stalled = new Error(
            'SMTP session stopped responding earlier in this batch'
          );
          while (results.length < mails.length) {
            results.push({ ok: false, error: stalled });
          }
          break;
        }
      }
    }
  } finally {
    // Connections are per-batch; a Worker has no process to keep a pool alive.
    await mailer.close();
  }

  return results;
};

export const sendMail = async (mail: OutgoingMail): Promise<void> => {
  const [result] = await sendMails([mail]);

  if (!result.ok) {
    throw result.error;
  }
};

export default sendMail;
