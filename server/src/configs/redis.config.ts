/**
 * Drop-in replacement for the ioredis client, backed by Durable Objects.
 *
 * Covers exactly the commands this codebase issues — SETEX/GETDEL for
 * single-use auth and error codes (`auth.repository.ts`), and GET/SET/DEL for
 * the organizer permission cache (`checkOrganizer.middleware.ts`).
 *
 * Workers KV would be the obvious swap, but it is the wrong tool for the codes:
 * it is eventually consistent (a code written during the Google callback may
 * not be visible to the exchange request that immediately follows), and it has
 * no atomic read-and-delete, which is what stops a code being redeemed twice.
 * A Durable Object per key gives both. See `src/worker/ephemeralStore.do.ts`.
 *
 * Rate limiting is deliberately NOT here: it used `EVAL` with a Lua script and
 * `SCAN`, neither of which has a sensible shim. Those call sites talk to
 * `src/worker/rateLimiter.do.ts` directly.
 */

import { bindings } from '../worker/runtime';

const stubFor = (key: string) => {
  const namespace = bindings().EPHEMERAL_STORE;
  return namespace.get(namespace.idFromName(key));
};

export const redis = {
  /** SETEX key ttl value */
  async setex(key: string, ttlSeconds: number, value: string): Promise<'OK'> {
    return stubFor(key).setex(value, ttlSeconds);
  },

  /**
   * SET key value [EX ttl]
   *
   * Accepts the ioredis variadic form used by the organizer cache:
   *   redis.set(key, value, 'EX', 300)
   */
  async set(
    key: string,
    value: string,
    mode?: string,
    ttlSeconds?: number
  ): Promise<'OK'> {
    const ttl =
      mode?.toUpperCase() === 'EX' && ttlSeconds !== undefined
        ? ttlSeconds
        : undefined;
    return stubFor(key).set(value, ttl);
  },

  async get(key: string): Promise<string | null> {
    return stubFor(key).get();
  },

  /** GETDEL key — returns the value and removes it, atomically. */
  async getdel(key: string): Promise<string | null> {
    return stubFor(key).getdel();
  },

  /** DEL key [key ...] — returns how many existed. */
  async del(...keys: string[]): Promise<number> {
    const removed = await Promise.all(keys.map((k) => stubFor(k).del()));
    return removed.reduce((total: number, n: number) => total + n, 0);
  },
};

export default redis;
