/**
 * Prisma client bound to Cloudflare D1.
 *
 * Two things differ from the previous Postgres setup:
 *
 * 1. The client is created per isolate, lazily, because the D1 binding only
 *    exists once a handler has run `seedRuntime(env)`. A module-level
 *    `new PrismaClient()` would evaluate too early.
 *
 * 2. There is no `$transaction` wrapper any more. D1 does not implement
 *    interactive transactions — Prisma would silently run the callback's
 *    queries individually, which looks atomic but is not. The repositories now
 *    express those guards as single conditional statements instead. Grouping
 *    independent writes is still available via `prisma.$transaction([...])`,
 *    which the adapter maps onto D1's atomic batch API.
 */

import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaClient } from '../generated/prisma/client';
import { bindings } from '../worker/runtime';

let client: PrismaClient | null = null;

const getClient = (): PrismaClient => {
  client ??= new PrismaClient({
    adapter: new PrismaD1(bindings().DB),
  });
  return client;
};

/**
 * Proxy so existing `import prisma from '.../prisma.config'` call sites keep
 * working: the real client is built on first property access, by which point
 * the bindings are in place.
 */
const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient();
    const value = Reflect.get(instance, property, instance);
    // Methods must stay bound to the client, not to the proxy.
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export default prisma;
