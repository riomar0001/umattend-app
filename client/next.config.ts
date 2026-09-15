import type { NextConfig } from 'next';

/**
 * Origin of the API Worker, used only on the server to build the `/api` proxy
 * below. Never sent to the browser, so it can change without affecting the
 * client bundle.
 *
 * Must be an absolute origin — e.g. https://api.umattend.site. It deliberately
 * does NOT fall back to NEXT_PUBLIC_API_URL: that value is relative (`/api/v1`)
 * so the browser stays same-origin, and using it here would rewrite
 * `/api/v1/auth/google` to `/api/v1/api/v1/auth/google`, which matches no route
 * and 404s.
 *
 * Note that `rewrites()` is evaluated during `next build` and baked into the
 * routes manifest — it is not re-read per request. Changing this requires a
 * redeploy, and on Vercel the variable must be present for the environment
 * being built (Production vs Preview are separate).
 */
const apiOrigin = process.env.API_ORIGIN?.trim();

const isAbsolute = (value: string) => /^https?:\/\//.test(value);

if (apiOrigin && !isAbsolute(apiOrigin)) {
  throw new Error(
    `API_ORIGIN must be an absolute origin starting with http:// or https:// (got "${apiOrigin}"). ` +
      'It is the destination of the /api proxy; a relative value creates a rewrite loop that 404s.'
  );
}

// A missing API_ORIGIN means every /api request 404s, which is painful to
// diagnose from a deployed 404 page. Fail the build instead.
if (!apiOrigin && process.env.VERCEL) {
  throw new Error(
    'API_ORIGIN is not set. The frontend proxies /api/* to the API Worker, so this is required. ' +
      'Set it in Vercel > Settings > Environment Variables for the environment being built ' +
      '(e.g. https://api.umattend.site), then redeploy.'
  );
}

const nextConfig: NextConfig = {
  // Vercel builds its own output format; `standalone` is for the Docker image
  // (see Dockerfile) and confuses the Vercel builder if left on.
  ...(process.env.VERCEL ? {} : { output: 'standalone' as const }),

  async rewrites() {
    if (!apiOrigin) {
      return [];
    }
    // Keeps every browser request same-origin: the page calls /api/v1/... on
    // its own host and this forwards it to the Worker. That avoids CORS
    // entirely, which is why NEXT_PUBLIC_API_URL must stay relative.
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin.replace(/\/+$/, '')}/api/:path*`
      }
    ];
  },

  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev']
};

export default nextConfig;
