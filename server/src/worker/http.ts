/**
 * Runs the existing Express application inside a Worker.
 *
 * `httpServerHandler` maps Workers' `fetch` model onto Node's `http.Server`
 * interface, so `src/app.ts` and every route, controller and middleware under
 * it stay as they are. The port passed to `listen()` is only a routing key —
 * nothing binds a real socket.
 */

import { httpServerHandler } from 'cloudflare:node';

/** Arbitrary; only used to pair `listen()` with `httpServerHandler()`. */
const ROUTING_PORT = 8787;

interface FetchHandler {
  fetch(
    request: Request,
    env: unknown,
    ctx: ExecutionContext
  ): Response | Promise<Response>;
}

let pending: Promise<FetchHandler> | null = null;

const build = async (): Promise<FetchHandler> => {
  // Imported dynamically so it runs *after* seedRuntime() has populated
  // process.env — app.ts and the constants it pulls in read env at module
  // scope and would otherwise throw on a missing variable.
  const { default: app } = await import('../app');

  // A module whose top-level evaluation threw is not re-evaluated on a second
  // import; the runtime hands back a namespace with no exports instead. Calling
  // `app.listen` on that reports "Cannot read properties of undefined", which
  // hides whatever actually failed — usually a missing env var.
  if (!app) {
    throw new Error(
      'src/app.ts failed to initialise. The original error was thrown during ' +
        'module evaluation — check the first error logged for this isolate ' +
        '(commonly a missing required environment variable).'
    );
  }

  app.listen(ROUTING_PORT);

  return httpServerHandler({ port: ROUTING_PORT }) as FetchHandler;
};

/**
 * Cached per isolate. The promise (rather than the resolved value) is memoised
 * so concurrent first requests cannot both call `listen()`.
 *
 * The rejection is cached too. Retrying cannot help — module evaluation is not
 * repeated — so keeping the failed promise means every subsequent request
 * reports the same real error instead of a confusing second-order one.
 */
export const httpHandler = (): Promise<FetchHandler> => {
  pending ??= build();
  return pending;
};
