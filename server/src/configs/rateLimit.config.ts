/**
 * Access to the sliding-window rate limiter.
 *
 * Replaces the Redis `EVAL` + Lua script and the `SCAN`/`KEYS` enumeration the
 * admin panel used. See `src/worker/rateLimiter.do.ts` for why every key lives
 * in one Durable Object instead of one per key.
 */

import { bindings } from '../worker/runtime';
import type { RateLimitEntry } from '../worker/rateLimiter.do';

/** All rate-limit state lives in a single, fixed instance. */
const store = () => {
  const namespace = bindings().RATE_LIMITER;
  return namespace.get(namespace.idFromName('global'));
};

export const rateLimitStore = {
  /** True when the request is within the window's limit. */
  allow(key: string, windowMs: number, limit: number): Promise<boolean> {
    return store().allow(key, windowMs, limit);
  },

  list(prefix: string, windowMs: number): Promise<RateLimitEntry[]> {
    return store().list(prefix, windowMs);
  },

  delete(key: string): Promise<void> {
    return store().delete(key);
  },

  deleteAll(prefix: string): Promise<number> {
    return store().deleteAll(prefix);
  },
};

export type { RateLimitEntry };
export default rateLimitStore;
