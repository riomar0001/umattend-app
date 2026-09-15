/**
 * Bridges the Workers binding model to the code that predates it.
 *
 * Workers hand bindings to each handler invocation rather than exposing them as
 * ambient globals, but most of this codebase reads configuration at module
 * scope through `getEnv()` (see `src/utils/envHandler.ts`). `seedRuntime()` is
 * called at the top of every handler — before any application module is
 * imported — so that both styles work:
 *
 *   - plain vars and secrets are copied into `process.env`
 *   - non-serialisable bindings (queues, Durable Objects, Hyperdrive) are held
 *     here and reached through `bindings()`
 *
 * Storing `env` in a module-scoped variable is safe: bindings are identical for
 * every request handled by a given isolate, so there is nothing request-scoped
 * to leak between concurrent invocations.
 */

import type { Env } from './env';

let current: Env | null = null;

/** Values that must never be flattened into `process.env`. */
const isPlainValue = (value: unknown): value is string | number | boolean =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean';

export const seedRuntime = (env: Env): void => {
  current = env;

  for (const [key, value] of Object.entries(env)) {
    if (isPlainValue(value)) {
      process.env[key] = String(value);
    }
  }
};

export const bindings = (): Env => {
  if (!current) {
    throw new Error(
      'Worker bindings are not available yet — seedRuntime(env) must run before any handler logic.'
    );
  }
  return current;
};
