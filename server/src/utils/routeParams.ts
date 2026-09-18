import type { Request } from 'express';

/**
 * Read a route parameter as a string.
 *
 * Express 5 types `req.params` as `{ [key: string]: string | string[] }`,
 * because a wildcard segment (`/files/*path`) yields an array of the matched
 * parts. Every route in this app uses only named segments (`:event_id`,
 * `:userId`), so the value is always a string at runtime — but the declared
 * union still has to be narrowed, and `tsc` was reporting 33 errors where it
 * was passed straight into a `string` parameter.
 *
 * Narrowed here rather than cast at each call site, so that if a wildcard route
 * is ever added the array case is handled rather than silently stringified into
 * `"a,b"` by an implicit coercion.
 */
export const routeParam = (req: Request, name: string): string => {
  const value = req.params[name];

  if (Array.isArray(value)) {
    // Wildcard match: rejoin the segments into the path they came from.
    return value.join('/');
  }

  return value ?? '';
};
