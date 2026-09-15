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
}

export const getSmtpConfig = (): SmtpConfig => {
  // SMTP account used to authenticate. With Gmail this is the mailbox that owns
  // the App Password, which is not necessarily the address mail appears to come
  // from.
  const user = getEnv('MAIL_USER');

  return {
    host: getEnv('MAIL_HOST'),
    port: parseInt(getEnv('MAIL_PORT', false)),
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
  };
};
