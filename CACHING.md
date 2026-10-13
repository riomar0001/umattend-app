# Caching and measurement

The frontend runs on Next.js; the API runs Express in a Cloudflare Worker with Prisma and D1.

## Versioned assets

Next.js already emits content-hashed JS, CSS, fonts and static image imports under /_next/static with Cache-Control: public, max-age=31536000, immutable in production. Redeploying changes their URLs. The installed Next.js guide explicitly says these headers cannot be overridden, so no duplicate next.config headers were added. Public files with stable names and HTML must not receive this policy.

Verify the deployed frontend (or a local production build):

    node server/scripts/check-asset-cache.mjs https://umattend.site

Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/headers

## Server data cache

Only JSON data is cached, after the existing route authentication and role/organizer checks:

| Data | TTL | Key scope |
| --- | --- | --- |
| Admin dashboard aggregates | 30 seconds | Global admin statistics |
| Event attendance totals | 15 seconds | Event ID |
| Event title used by exports | 5 minutes | Event ID |

Departments/programs are already compiled frontend constants, so they need no database cache. Permission decisions and personalized event lists are not included in this new cache.

The existing EPHEMERAL_STORE binding hosts a dedicated data-cache:v1 Durable Object instance. Atomic generation checks prevent a read started before a mutation from restoring stale entries. Storage is capped at 128 live entries; expiration is checked on access and expired entries are pruned on fills. No extra binding or migration is needed. This uses the existing strongly consistent store to coordinate invalidation across HTTP, queue and cron writes. It adds a store round trip per cache lookup and invalidation; measure whether it pays off for these aggregates before extending it. No cross-request promises or isolate-local data are shared.

Prisma model mutations to users, students, events and attendance await global invalidation, including partially failed mutations. Aggregate data is the same for every authorized reader in this single-campus app. Any future tenant or permission-dependent result must include that scope in its key. Current application raw SQL is a health-check SELECT; future raw mutations must explicitly invalidate this cache. Invalidation failures are logged and entries remain bounded by their TTL; cache read/write failures fall back to the database. External database edits also become visible by TTL.

API HTTP responses retain their private no-store policy; authentication is never skipped by an edge response cache.

## Measure before extending

Every API response emits an api_performance record with a sanitized route template, status, durationMs, cache outcomes and Prisma database read/write operation counts. databaseOperationMs sums operation durations and may exceed request duration for parallel queries. These are logical Prisma operations, not physical SQL statement counts or rows scanned. Nested writes may execute multiple statements. Obtain actual queries, rows read and rows written from D1 Metrics and Analytics, for the same environment and measurement interval:

https://developers.cloudflare.com/d1/observability/metrics-analytics/

The frontend samples 10% of production page loads for TTFB, FCP, LCP, CLS, INP and full load duration. It sends only allowlisted route labels and numeric metrics to /api/v1/performance. The receiver enforces a 2 KB payload limit and 60 reports per minute per client IP. No URL parameters, IDs, tokens or profile data are included. The proxy's existing API_PROXY_SECRET configuration must be correct for per-client IP limits. No extra third-party analytics service is introduced.

From the server folder, capture comparable staging traffic for baseline and cached runs:

    npx wrangler tail --env staging --format json > cached.ndjson
    node scripts/summarize-performance.mjs cached.ndjson

Set DATA_CACHE_ENABLED=false in the staging Worker's variables (or local .dev.vars) for the baseline; redeploy/restart as appropriate. Remove it or set true for the cached run. Invalidation remains active during bypass. Keep build, workload, users, browser/device and measurement interval comparable. Record cold and warm requests separately; compare request totals, cache hits/errors, p50/p95 API latency, read operations per request, actual D1 rows read, and browser LCP/load. CLS is unitless; other browser metrics are milliseconds. Browser metric counts are samples, not total visits, and synthetic client reports are untrusted telemetry. Avoid interpreting small samples as an improvement.

No production before/after numbers are claimed by this change. Collect the two runs before deciding to cache additional endpoints.

## Verification in this change

Nine Node regression tests pass, including TTL expiry, warm hits, mutation invalidation, stale-fill prevention, cache outage fallback, storage limits and organizer access. The server type check and changed-file lint pass; the new frontend component passes its isolated type check. The full client type check is blocked by the existing missing jsqr dependency in four scanner components.

A local Miniflare integration test with an isolated D1 database and dummy credentials exercised the actual Worker, Express, Prisma and Durable Objects. An initial dashboard request recorded 16 logical database reads and 97 ms; the warm request recorded zero reads and 2 ms. A role update invalidated the cache and the next read returned fresh totals. These single local timings include cold initialization and are not a production benchmark.

The production asset check confirmed the one-year immutable headers on ten font/CSS/JS assets. A staging Worker dry run bundled successfully and uploaded nothing. Wrangler reported existing configuration warnings, including staging inheriting the production API custom domain. Correct staging's routes before any staging deployment; otherwise deploying staging could reassign api.umattend.site. No deployment was performed.
