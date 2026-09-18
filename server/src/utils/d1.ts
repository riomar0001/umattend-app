/**
 * Working within D1's per-statement bound-parameter cap.
 *
 * D1 rejects any statement carrying more than 100 bound parameters:
 *
 *   D1_ERROR: too many SQL variables at offset N: SQLITE_ERROR
 *
 * Prisma expands `{ in: [...] }` into one placeholder per element, so a filter
 * built from an unbounded array — a page of ids, a client-supplied list of
 * students, the events due in a cron sweep — crosses the line as soon as the
 * array passes ~98 and fails outright rather than degrading. The limit applies
 * per statement, including each statement inside a `$transaction([...])`.
 *
 * `chunk()` splits such an array; `MAX_IN_CLAUSE_SIZE` leaves room for the
 * handful of other parameters a statement normally carries (an UPDATE's `data`
 * fields, an extra `where` predicate). Callers whose statement binds an unusual
 * number of non-`in` values should pass a smaller size explicitly.
 */

/** D1's hard cap, for reference — see the module docblock. */
export const D1_MAX_BOUND_PARAMS = 100;

/**
 * Default `in:` batch size.
 *
 * Deliberately below the cap: an `updateMany` binds its `data` fields too, so
 * `IN (n ids)` plus `check_out_at` plus `check_out_by` is n + 2 parameters. Ten
 * spare slots covers every statement in this codebase.
 */
export const MAX_IN_CLAUSE_SIZE = 90;

/** Split `items` into consecutive batches of at most `size`. */
export const chunk = <T>(
  items: readonly T[],
  size: number = MAX_IN_CLAUSE_SIZE
): T[][] => {
  if (size < 1) {
    throw new RangeError('chunk size must be at least 1');
  }

  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

/**
 * Run `query` once per batch and concatenate the rows.
 *
 * The batches run sequentially. D1 processes queries for a database serially
 * anyway, so firing them together would not be faster, and it would multiply
 * the peak number of in-flight subrequests against the per-invocation cap.
 */
export const queryInBatches = async <T, R>(
  items: readonly T[],
  query: (batch: T[]) => Promise<R[]>,
  size: number = MAX_IN_CLAUSE_SIZE
): Promise<R[]> => {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = [];
  for (const batch of chunk(items, size)) {
    results.push(...(await query(batch)));
  }
  return results;
};

/**
 * Run `mutation` once per batch and sum the affected-row counts.
 *
 * Note that this is not atomic across batches: a failure partway through leaves
 * earlier batches applied. Every caller here is idempotent and re-asserts its
 * own precondition in the `where` clause, so a retry converges.
 */
export const mutateInBatches = async <T>(
  items: readonly T[],
  mutation: (batch: T[]) => Promise<{ count: number }>,
  size: number = MAX_IN_CLAUSE_SIZE
): Promise<number> => {
  if (items.length === 0) {
    return 0;
  }

  let total = 0;
  for (const batch of chunk(items, size)) {
    const { count } = await mutation(batch);
    total += count;
  }
  return total;
};
