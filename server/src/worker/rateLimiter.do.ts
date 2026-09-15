/**
 * Durable Object implementing the sliding-window rate limiter that used to be a
 * Redis Lua script (`slidingWindowScript` in rateLimiter.middleware.ts).
 *
 * Unlike the other stores this is a **single instance** holding every key,
 * rather than one instance per key. That is forced by the admin panel: it lists
 * and clears limits with `SCAN`/`KEYS`, and Durable Objects cannot be
 * enumerated by name — only the storage *inside* one object can be listed by
 * prefix. Keeping them together makes `getRateLimits`/`deleteAllRateLimits`
 * possible and keeps every operation atomic, since a DO processes one call at a
 * time. The trade-off is that all rate-limit traffic serialises through this
 * object; at this application's scale that is well within a single DO's budget.
 *
 * Each key stores the timestamps of the requests inside the current window,
 * which is the sorted-set-of-scores the Lua script maintained.
 */

import { DurableObject } from 'cloudflare:workers';

export interface RateLimitEntry {
  key: string;
  count: number;
  /** Seconds until the window empties; -1 when unknown, matching Redis PTTL. */
  ttl: number;
}

export class RateLimiterStore extends DurableObject {
  /** Drop timestamps that have aged out of the window. */
  private static prune(hits: number[], now: number, windowMs: number): number[] {
    return hits.filter((t) => t > now - windowMs);
  }

  /**
   * Records a hit and reports whether it is allowed — the equivalent of the
   * Lua script's ZREMRANGEBYSCORE / ZCARD / ZADD sequence.
   */
  async allow(key: string, windowMs: number, limit: number): Promise<boolean> {
    const now = Date.now();
    const stored = (await this.ctx.storage.get<number[]>(key)) ?? [];
    const hits = RateLimiterStore.prune(stored, now, windowMs);

    if (hits.length >= limit) {
      // Still persist the pruning so the window keeps sliding.
      await this.ctx.storage.put(key, hits);
      return false;
    }

    hits.push(now);
    await this.ctx.storage.put(key, hits);
    return true;
  }

  /** Replaces SCAN + the admin count script. Empty keys are dropped. */
  async list(prefix: string, windowMs: number): Promise<RateLimitEntry[]> {
    const now = Date.now();
    const all = await this.ctx.storage.list<number[]>({ prefix });
    const entries: RateLimitEntry[] = [];

    for (const [key, stored] of all) {
      const hits = RateLimiterStore.prune(stored, now, windowMs);

      if (hits.length === 0) {
        await this.ctx.storage.delete(key);
        continue;
      }

      await this.ctx.storage.put(key, hits);

      // Time until the oldest hit leaves the window — the analogue of PTTL.
      const oldest = Math.min(...hits);
      entries.push({
        key,
        count: hits.length,
        ttl: Math.ceil((oldest + windowMs - now) / 1000),
      });
    }

    return entries;
  }

  async delete(key: string): Promise<void> {
    await this.ctx.storage.delete(key);
  }

  /** Returns how many keys were removed, matching `redis.del(...keys)`. */
  async deleteAll(prefix: string): Promise<number> {
    const all = await this.ctx.storage.list<number[]>({ prefix });
    const keys = [...all.keys()];
    if (keys.length === 0) {
      return 0;
    }
    await this.ctx.storage.delete(keys);
    return keys.length;
  }
}
