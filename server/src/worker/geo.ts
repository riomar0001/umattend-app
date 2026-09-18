/**
 * Cloudflare's own geolocation, carried into Express as request headers.
 *
 * Cloudflare resolves the connecting IP to a city/region/country before the
 * Worker is even invoked and hands the result over on `request.cf` — free, with
 * no subrequest, no timeout and no third-party dependency. The previous
 * approach called `http://ip-api.com/json/<ip>` on the login path, which:
 *
 *   - blocked token issue on an external round trip (5s timeout);
 *   - is rate-limited to 45 requests/minute *per source IP*, and every Worker
 *     shares Cloudflare's egress addresses — so it gets throttled under load and
 *     silently degrades to "Unknown";
 *   - is plaintext HTTP on the free tier.
 *
 * `request.cf` is not reachable from Express, which only sees a Node-style
 * IncomingMessage. Bridging it as headers keeps `src/app.ts` and every route
 * below it unaware of the Workers runtime, which is the same contract
 * `worker/http.ts` maintains.
 *
 * NOTE: these headers describe whoever connected to Cloudflare. When the
 * frontend proxies /api/* the connecting party is that proxy, so the values
 * describe the proxy's datacenter rather than the visitor — see
 * `utils/clientIp.ts` for how the real address is recovered, and
 * `utils/geoHeaders.ts` for how the two are reconciled.
 */

export const GEO_CITY_HEADER = 'x-cf-geo-city';
export const GEO_REGION_HEADER = 'x-cf-geo-region';
export const GEO_COUNTRY_HEADER = 'x-cf-geo-country';
/** Whether the geo above describes the visitor or merely the proxy in front. */
export const GEO_SOURCE_HEADER = 'x-cf-geo-source';

const clean = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Return a copy of `request` carrying Cloudflare's geo as headers.
 *
 * Inbound copies are deleted unconditionally before anything is written, so a
 * caller cannot smuggle in a location by setting these headers itself. When
 * `request.cf` is absent — `wrangler dev` without the edge, or a test harness —
 * the headers are simply not set and downstream falls back to "Unknown".
 */
export const withGeoHeaders = (request: Request): Request => {
  const headers = new Headers(request.headers);

  headers.delete(GEO_CITY_HEADER);
  headers.delete(GEO_REGION_HEADER);
  headers.delete(GEO_COUNTRY_HEADER);
  headers.delete(GEO_SOURCE_HEADER);

  const cf = request.cf as
    | { city?: unknown; region?: unknown; country?: unknown }
    | undefined;

  const city = clean(cf?.city);
  const region = clean(cf?.region);
  const country = clean(cf?.country);

  if (city) {
    headers.set(GEO_CITY_HEADER, city);
  }
  if (region) {
    headers.set(GEO_REGION_HEADER, region);
  }
  if (country) {
    headers.set(GEO_COUNTRY_HEADER, country);
  }
  if (city || region || country) {
    headers.set(GEO_SOURCE_HEADER, 'cf');
  }

  return new Request(request, { headers });
};
