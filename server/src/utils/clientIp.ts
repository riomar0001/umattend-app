import type { Request } from 'express';
import getEnv from '@/utils/envHandler';

/**
 * The real visitor's IP address.
 *
 * Shared by the login-history recorder (`auth.controller`) and the rate limiter,
 * which previously carried two slightly different copies of this logic and were
 * wrong in the same way.
 *
 * ## Why CF-Connecting-IP is not enough
 *
 * The frontend proxies `/api/*` to this Worker (see `client/next.config.ts`), so
 * the Worker's TCP peer is a Vercel function, not the browser. CF-Connecting-IP
 * is authoritative about *who connected to Cloudflare* — and that is the proxy.
 * Trusting it alone meant:
 *
 *   - every login was recorded from an AWS region (Singapore, Hong Kong)
 *     instead of the user's actual location;
 *   - every visitor shared a single `rateLimit:ip:<vercel-ip>` bucket, so the
 *     300 req/min per-IP budget was really 300 req/min for the whole user base.
 *
 * ## Why the proxy header is trusted only with a secret
 *
 * `x-umattend-client-ip` is set by the Next.js middleware. On its own it is an
 * unverifiable claim: anyone can reach api.umattend.site directly and assert any
 * address, which would let them forge the location in their own login history
 * and evade per-IP limits. It is therefore honoured only alongside a matching
 * `x-umattend-proxy-secret`, which only the proxy knows.
 *
 * When the secret is unset on either side, or does not match, this falls back to
 * CF-Connecting-IP. That is the old, wrong-but-unspoofable behaviour.
 */

const CLIENT_IP_HEADER = 'x-umattend-client-ip';
const PROXY_SECRET_HEADER = 'x-umattend-proxy-secret';

const header = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Constant-time-ish comparison.
 *
 * The secret is compared per request, and a naive `===` leaks its length and
 * prefix through timing. Not a realistic attack over the public internet, but
 * the comparison is cheap enough that there is no reason to leave it open.
 */
const secretMatches = (provided: string, expected: string): boolean => {
  if (provided.length !== expected.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
};

/** True when this request genuinely arrived through the frontend proxy. */
export const isTrustedProxyRequest = (req: Request): boolean => {
  const expected = getEnv('API_PROXY_SECRET', false);
  const provided = header(req, PROXY_SECRET_HEADER);

  if (!expected || !provided) {
    return false;
  }

  return secretMatches(provided, expected);
};

export const clientIp = (req: Request): string => {
  if (isTrustedProxyRequest(req)) {
    const forwarded = header(req, CLIENT_IP_HEADER)?.trim();
    if (forwarded) {
      return forwarded;
    }
  }

  // Direct hit on the API host: Cloudflare sets this from the connection
  // itself, so it cannot be spoofed by the caller.
  const cfIp = header(req, 'cf-connecting-ip')?.trim();
  if (cfIp) {
    return cfIp;
  }

  // Local development, where there is no Cloudflare edge in front.
  return req.ip ?? 'unknown';
};

export default clientIp;
