// TODO migrate the endpoints to secrets
import type { NextConfig } from 'next';

// Use API_URL from environment, fallback to empty string for build-time
// The actual API URL will be set at runtime via environment variables
const apiBase = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    // Only add rewrites if apiBase is configured
    if (!apiBase) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`
      }
    ];
  },
  allowedDevOrigins: ['local-origin.dev', '*.local-origin.dev', 'staging.umattend.site', 'umattend.site']
};

export default nextConfig;
