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

  /**
   * Signs the student attendance QR tokens.
   *
   * Required, and read at module scope by `constants/jwt.constants`. If it is
   * missing, `src/app.ts` throws during module evaluation and `httpHandler()`
   * caches the rejection — so every request for the life of the isolate fails,
   * not just the QR ones. TTL is in SECONDS, unlike the hour-based TTLs above.
   */
  JWT_ATTENDANCE_TOKEN_SECRET: string;
  JWT_ATTENDANCE_TOKEN_TTL: string;

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
  /** Written directly by the consumers to record *why* a job failed. */
  DLQ: Queue<import('./deadLetter').DeadLetterEnvelope>;

  /**
   * Queue names, mirroring the bindings above. Bindings carry no name at
   * runtime, and the Queues REST API used to read the DLQ addresses queues by
   * name/id rather than by binding — see `configs/queuesApi.config.ts`.
   */
  EMAIL_QUEUE_NAME: string;
  EVENT_STATUS_QUEUE_NAME: string;
  DLQ_NAME: string;

  /** Account id and a Queues Read+Write token, for the DLQ pull consumer. */
  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;

  /**
   * Shared with the frontend's Next.js middleware, which proxies /api/*.
   *
   * The proxy is the party that connects to Cloudflare, so CF-Connecting-IP is
   * the proxy's address rather than the visitor's. The middleware forwards the
   * real IP and location, and this secret is what makes those headers
   * trustworthy — without it they are a claim anyone could make by calling the
   * API host directly. Optional: when unset, both sides fall back to
   * CF-Connecting-IP. See `utils/clientIp.ts`.
   */
  API_PROXY_SECRET?: string;

  // ---------- durable objects ----------
  EPHEMERAL_STORE: DurableObjectNamespace<
    import('./ephemeralStore.do').EphemeralStore
  >;
  RATE_LIMITER: DurableObjectNamespace<
    import('./rateLimiter.do').RateLimiterStore
  >;
}
