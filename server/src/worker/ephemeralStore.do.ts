/**
 * Durable Object backing the short-lived key/value store that used to be Redis.
 *
 * One instance per key (`idFromName(key)`), which is what makes `getdel()`
 * genuinely atomic: a Durable Object processes one request at a time, so two
 * concurrent redemptions of the same OAuth auth code cannot both observe the
 * value. Workers KV would not do — it is eventually consistent, so a code
 * written during the Google callback might not be readable by the immediately
 * following exchange request.
 *
 * Covers the two uses staging has: single-use auth/error codes
 * (`auth.repository.ts`) and the organizer permission cache
 * (`checkOrganizer.middleware.ts`).
 *
 * Entries self-expire via an alarm so storage is not retained past the TTL.
 */

import { DurableObject } from 'cloudflare:workers';

interface Entry {
  value: string;
  /** Absolute epoch ms, or null for no expiry. */
  expiresAt: number | null;
}

const KEY = 'entry';

export class EphemeralStore extends DurableObject {
  private async read(): Promise<string | null> {
    const entry = await this.ctx.storage.get<Entry>(KEY);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      await this.clear();
      return null;
    }
    return entry.value;
  }

  /** SETEX: store `value`, expiring after `ttlSeconds`. */
  async setex(value: string, ttlSeconds: number): Promise<'OK'> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    await this.ctx.storage.put<Entry>(KEY, { value, expiresAt });
    await this.ctx.storage.setAlarm(expiresAt);
    return 'OK';
  }

  /** SET, optionally with an expiry in seconds. */
  async set(value: string, ttlSeconds?: number): Promise<'OK'> {
    if (ttlSeconds !== undefined) {
      return this.setex(value, ttlSeconds);
    }
    await this.ctx.storage.put<Entry>(KEY, { value, expiresAt: null });
    // An alarm left over from an earlier setex() on this same key would still
    // be pending, and alarm() calls deleteAll() — so without this the value
    // just written as non-expiring would be wiped at the *old* expiry. Matches
    // Redis, where a plain SET clears any TTL on the key.
    await this.ctx.storage.deleteAlarm();
    return 'OK';
  }

  /** GET, honouring the recorded expiry. */
  async get(): Promise<string | null> {
    return this.read();
  }

  /** GETDEL: read and remove in one indivisible step. */
  async getdel(): Promise<string | null> {
    const value = await this.read();
    if (value !== null) {
      await this.clear();
    }
    return value;
  }

  /** DEL. Returns 1 if something was removed, mirroring Redis. */
  async del(): Promise<number> {
    const existed = (await this.ctx.storage.get<Entry>(KEY)) !== undefined;
    await this.clear();
    return existed ? 1 : 0;
  }

  async alarm(): Promise<void> {
    await this.clear();
  }

  private async clear(): Promise<void> {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }
}
