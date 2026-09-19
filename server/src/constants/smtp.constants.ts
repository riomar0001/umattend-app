import getEnv from '@/utils/envHandler';

/**
 * Read lazily, NOT at module scope.
 *
 * The queue consumer imports this chain statically from `src/worker/index.ts`,
 * so it is part of the Worker's top-level module graph. Cloudflare evaluates
 * that graph when validating an upload — before any handler runs and therefore
 * before `seedRuntime()` has populated `process.env` — so a `getEnv()` call out
 * here fails the deploy outright with a 10021 validation error rather than at
 * runtime.
 *
 * Everything else that reads env at module scope (app/google/jwt constants) is
 * only reachable through `src/app.ts`, which `worker/http.ts` imports
 * dynamically for exactly this reason.
 */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  fromName: string;
  /** Pause between consecutive sends on one connection, in milliseconds. */
  sendIntervalMs: number;
}

/**
 * Gmail throttles a mailbox that sends in a tight loop ("421 4.7.0 Try again
 * later"), so messages are spaced out even though they share one login. A
 * second is slow enough for Gmail and still clears a full batch well inside the
 * queue consumer's time budget.
 */
const DEFAULT_SEND_INTERVAL_MS = 1000;

export const getSmtpConfig = (): SmtpConfig => {
  // SMTP account used to authenticate. With Gmail this is the mailbox that owns
  // the App Password, which is not necessarily the address mail appears to come
  // from.
  const user = getEnv('MAIL_USER');

  // Defaulted rather than parsed straight through: getEnv(_, false) returns
  // undefined when unset, and parseInt(undefined) is NaN, which reaches
  // WorkerMailer.connect as the port and fails with a connection error that
  // says nothing about the missing variable. 587 is the submission port the
  // rest of this file documents.
  const port = Number.parseInt(getEnv('MAIL_PORT', false) ?? '', 10);

  // Tunable without a code deploy, so the interval can be widened if Gmail
  // starts throttling again. Same NaN guard as the port above.
  const sendIntervalMs = Number.parseInt(
    getEnv('MAIL_SEND_INTERVAL_MS', false) ?? '',
    10
  );

  return {
    host: getEnv('MAIL_HOST'),
    port: Number.isInteger(port) ? port : 587,
    secure: getEnv('MAIL_SECURE', false) === 'true',
    user,
    pass: getEnv('MAIL_PASS'),
    // Envelope/header From. Defaults to the authenticating user so setups where
    // the two are the same keep working. When they differ, the provider must be
    // willing to send on this address's behalf — for Gmail that means adding it
    // under "Send mail as" and verifying it, otherwise Gmail silently rewrites
    // the header back to MAIL_USER.
    from: getEnv('MAIL_FROM', false) || user,
    fromName: getEnv('MAIL_FROM_NAME', false),
    sendIntervalMs:
      Number.isInteger(sendIntervalMs) && sendIntervalMs >= 0
        ? sendIntervalMs
        : DEFAULT_SEND_INTERVAL_MS,
  };
};
