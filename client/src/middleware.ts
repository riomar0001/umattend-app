import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/'];

// Auth-related API routes (these should always be accessible)
const AUTH_API_ROUTES = ['/api/v1/auth'];

/**
 * Header carrying the real visitor IP across the /api proxy hop.
 *
 * `next.config.ts` rewrites /api/:path* to the API Worker, which means the
 * Worker's TCP peer — and therefore its CF-Connecting-IP — is this Vercel
 * function, not the visitor. Left alone, every login is recorded from whichever
 * AWS region served the request, and every visitor shares one rate-limit
 * bucket. Middleware runs before `rewrites()`, so this is the last place that
 * still knows who actually called.
 */
const CLIENT_IP_HEADER = 'x-umattend-client-ip';

/**
 * Proves the IP header above came from this proxy.
 *
 * Without it the header would be a free-form claim: anyone can reach
 * api.umattend.site directly and assert any address, faking the location in
 * their own login history and side-stepping per-IP rate limits. The Worker
 * ignores the IP unless this matches, and falls back to CF-Connecting-IP.
 *
 * Must equal the API_PROXY_SECRET secret on the Worker. If either side is
 * unset, both fall back to CF-Connecting-IP — wrong, but never spoofable.
 */
const PROXY_SECRET_HEADER = 'x-umattend-proxy-secret';

/**
 * Visitor geolocation, forwarded for the same reason as the IP.
 *
 * The Worker would otherwise fall back to Cloudflare's `request.cf`, which
 * geolocates whoever connected to Cloudflare — this proxy — and so reports the
 * serving AWS region. Vercel's edge has already resolved the *real* client, so
 * forwarding its answer costs nothing and avoids a second lookup.
 *
 * Covered by PROXY_SECRET_HEADER along with the IP: an unverified location is
 * as forgeable as an unverified address.
 */
const GEO_HEADERS: Record<string, string> = {
  // Vercel's header -> the header the Worker reads.
  'x-vercel-ip-city': 'x-umattend-geo-city',
  'x-vercel-ip-country-region': 'x-umattend-geo-region',
  'x-vercel-ip-country': 'x-umattend-geo-country'
};

/**
 * The visitor's address, as seen by Vercel's edge.
 *
 * `x-vercel-forwarded-for` is set by the platform and any inbound copy is
 * stripped, so it is preferred. `x-forwarded-for` may carry a chain; the
 * left-most entry is the original client. `request.ip` is not used — it was
 * removed in Next 15.
 */
const visitorIp = (request: NextRequest): string | null => {
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) {
    return vercelForwarded.split(',')[0]?.trim() || null;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || null;
  }

  return request.headers.get('x-real-ip')?.trim() || null;
};

/**
 * Forward the visitor IP to the API Worker.
 *
 * Returns undefined when there is nothing to add, so non-API routes keep using
 * the plain `NextResponse.next()` path. Note that modified request headers only
 * reach the rewrite destination when they are passed through
 * `NextResponse.next({ request: { headers } })` — a bare `next()` drops them.
 */
const withClientIp = (request: NextRequest): NextResponse | undefined => {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return undefined;
  }

  const headers = new Headers(request.headers);

  // Strip any inbound copies first: these headers are assertions only this
  // middleware is allowed to make.
  headers.delete(CLIENT_IP_HEADER);
  headers.delete(PROXY_SECRET_HEADER);
  for (const target of Object.values(GEO_HEADERS)) {
    headers.delete(target);
  }

  const secret = process.env.API_PROXY_SECRET;
  const ip = visitorIp(request);

  if (!secret || !ip) {
    // Fail closed. The Worker sees no trusted header and uses
    // CF-Connecting-IP, which is this proxy — the pre-existing behaviour.
    return NextResponse.next({ request: { headers } });
  }

  headers.set(CLIENT_IP_HEADER, ip);
  headers.set(PROXY_SECRET_HEADER, secret);

  for (const [source, target] of Object.entries(GEO_HEADERS)) {
    const value = request.headers.get(source);
    if (value) {
      // Vercel percent-encodes these (e.g. "Davao%20City"); decode once here so
      // the Worker stores a display-ready value.
      try {
        headers.set(target, decodeURIComponent(value));
      } catch {
        headers.set(target, value);
      }
    }
  }

  return NextResponse.next({ request: { headers } });
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow all API auth routes
  if (AUTH_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return withClientIp(request) ?? NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname)) {
    // If user is already authenticated, redirect away from login page
    // We'll handle this on the client side in page.tsx since we can't access localStorage from middleware
    return NextResponse.next();
  }

  // For protected routes, we'll rely on client-side auth checking
  // since Zustand uses localStorage which isn't accessible in middleware
  // The actual protection will happen via the client-side redirect in each protected page
  return withClientIp(request) ?? NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
