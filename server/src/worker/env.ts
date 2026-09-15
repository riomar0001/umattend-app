/**
 * Typed view of the Worker's bindings, as declared in `wrangler.jsonc`.
 *
 * Plain `vars` and secrets are additionally mirrored into `process.env` by
 * `seedRuntime()` so the existing `getEnv()`-based constants keep working
 * unchanged — see `./runtime`.
 */

import type { EmailMessage, EventStatusMessage } from './messages';

export interface Env {
  // ---------- vars & secrets ----------
  NODE_ENV: string;
  FRONTEND_URL: string;
  API_URL: string;
  ALLOWED_ORIGINS: string;
  CORS_ORIGIN?: string;

  JWT_ACCESS_TOKEN_SECRET: string;
  JWT_ACCESS_TOKEN_TTL: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  JWT_REFRESH_TOKEN_TTL: string;
  JWT_GOOGLE_STATE_SECRET: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;

  MAIL_HOST: string;
  MAIL_PORT: string;
  MAIL_SECURE: string;
  /** SMTP login (the mailbox owning the App Password). */
  MAIL_USER: string;
  MAIL_PASS: string;
  /** Address mail is sent as; defaults to MAIL_USER when unset. */
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;

  // ---------- database ----------
  DB: D1Database;

  // ---------- queues (producers) ----------
  EMAIL_QUEUE: Queue<EmailMessage>;
  EVENT_STATUS_QUEUE: Queue<EventStatusMessage>;

  // ---------- durable objects ----------
  EPHEMERAL_STORE: DurableObjectNamespace<
    import('./ephemeralStore.do').EphemeralStore
  >;
  RATE_LIMITER: DurableObjectNamespace<
    import('./rateLimiter.do').RateLimiterStore
  >;
}
