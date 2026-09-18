import type { Request } from 'express';
import { isTrustedProxyRequest } from '@/utils/clientIp';
import {
  GEO_CITY_HEADER,
  GEO_COUNTRY_HEADER,
  GEO_REGION_HEADER,
} from '@/worker/geo';

/**
 * Where a login came from, without an external IP lookup.
 *
 * Replaces `getLocationByIp`, which called ip-api.com on the token-issue path.
 * Two sources feed this, chosen by how the request reached us:
 *
 *   - through the frontend proxy: Vercel's edge already geolocated the real
 *     visitor, and the middleware forwards its answer under the shared secret.
 *     Cloudflare's own view is useless here — it resolved the proxy.
 *   - directly against api.umattend.site: Cloudflare geolocated the visitor
 *     itself, and `worker/geo.ts` has copied that onto the request.
 *
 * Both are set from the connection rather than claimed by the caller, and the
 * proxy variant is rejected unless the secret matches, so neither is forgeable.
 */

/** Written by `client/src/middleware.ts`. Trusted only with the proxy secret. */
const PROXY_CITY_HEADER = 'x-umattend-geo-city';
const PROXY_REGION_HEADER = 'x-umattend-geo-region';
const PROXY_COUNTRY_HEADER = 'x-umattend-geo-country';

export interface RequestLocation {
  city: string;
  region: string;
  country: string;
}

const UNKNOWN = 'Unknown';

/**
 * Expand an ISO 3166-1 alpha-2 country code to its English name.
 *
 * Cloudflare (`request.cf.country`) and Vercel (`x-vercel-ip-country`) both
 * report codes, whereas the history UI has always displayed full names — the
 * previous ip-api.com lookup returned "Philippines", not "PH". Built into
 * workerd via ICU, so this costs nothing and needs no lookup table.
 *
 * Unknown codes are returned unchanged by `Intl.DisplayNames`, which is exactly
 * the fallback we want. Anything that is not a bare two-letter code is passed
 * through untouched, so an already-expanded name survives.
 */
const COUNTRY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

const countryName = (value: string): string => {
  if (!/^[A-Za-z]{2}$/.test(value)) {
    return value;
  }

  try {
    // Must be upper-cased: `of('ph')` returns "ph" unchanged.
    return COUNTRY_NAMES.of(value.toUpperCase()) ?? value;
  } catch {
    return value;
  }
};

const read = (req: Request, name: string): string | null => {
  const value = req.headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  const trimmed = first?.trim();
  if (trimmed === undefined || trimmed === '') {
    return null;
  }
  return trimmed;
};

/**
 * Resolve the request's location.
 *
 * Fields are reported individually rather than all-or-nothing: Cloudflare and
 * Vercel both omit `city` for some networks while still knowing the country,
 * and a row reading "Unknown, Unknown, Philippines" is more use than three
 * Unknowns.
 */
export const locationFromRequest = (req: Request): RequestLocation => {
  const viaProxy = isTrustedProxyRequest(req);

  const city = viaProxy
    ? read(req, PROXY_CITY_HEADER)
    : read(req, GEO_CITY_HEADER);
  const region = viaProxy
    ? read(req, PROXY_REGION_HEADER)
    : read(req, GEO_REGION_HEADER);
  const country = viaProxy
    ? read(req, PROXY_COUNTRY_HEADER)
    : read(req, GEO_COUNTRY_HEADER);

  return {
    city: city ?? UNKNOWN,
    region: region ?? UNKNOWN,
    country: country ? countryName(country) : UNKNOWN,
  };
};

export default locationFromRequest;
