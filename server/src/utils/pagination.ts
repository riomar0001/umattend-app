/**
 * Page/limit parsing for the admin listings.
 *
 * `parseInt(req.query.limit) || 20` was doing three things wrong at once:
 *
 *   - no upper bound, so `?limit=100000` became `take: 100000`. That is both an
 *     unbounded response and a filter wide enough to break the D1 query built
 *     from its results (see utils/d1 — 100 bound parameters per statement).
 *   - `?limit=-5` is truthy, so it reached Prisma as `take: -5`, silently
 *     switching to backwards pagination.
 *   - `?page=-1` produced `skip: -40`, which Prisma rejects — a 500 rather than
 *     a 400.
 *
 * Clamping here rather than only in the express-validator schema: that schema
 * is attached to one route out of three, and none of the controllers inspect
 * `validationResult` for it, so it rejects nothing on its own.
 */

/** Matches the `max` in PaginationSchema, and stays under D1's parameter cap. */
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  page: number;
  limit: number;
}

const toPositiveInt = (
  value: unknown,
  fallback: number,
  max: number
): number => {
  const parsed =
    typeof value === 'string' || typeof value === 'number'
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const floored = Math.floor(parsed);
  if (floored < 1) {
    return fallback;
  }

  return Math.min(floored, max);
};

/**
 * Read `page` and `limit` from a query string, clamped to a usable range.
 *
 * Out-of-range and unparseable values fall back to the default rather than
 * erroring: these are listing endpoints, and a hand-edited query string should
 * show the first page, not a stack trace.
 */
export const parsePagination = (
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit: number = MAX_PAGE_SIZE
): Pagination => ({
  page: toPositiveInt(query.page, 1, Number.MAX_SAFE_INTEGER),
  limit: toPositiveInt(query.limit, defaultLimit, maxLimit),
});
