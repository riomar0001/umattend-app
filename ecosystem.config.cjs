// PM2 process config — used by both staging and prod.
// Secrets (DATABASE_URL, JWT_SECRET, etc.) must be set in the shell env or a .env file
// loaded before running: pm2 start ecosystem.config.cjs --env staging|production
module.exports = {
  apps: [
    {
      name: 'umattend-staging-server',
      script: 'dist/server.js',
      cwd: './server',
      // --import loads tracing.ts output before any other module so OTel
      // instrumentation patches Express/HTTP before they are imported.
      node_args: '--import ./dist/telemetry/tracing.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'staging',
        PORT: 4001,
        OTEL_SERVICE_NAME: 'umattend-server-staging',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4321',
      },
    },
    {
      name: 'umattend-production-server',
      script: 'dist/server.js',
      cwd: './server',
      node_args: '--import ./dist/telemetry/tracing.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        OTEL_SERVICE_NAME: 'umattend-server',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4320',
      },
    },
    // Next.js calls instrumentation.ts register() automatically — no --import needed.
    // Standalone output: built by `pnpm build:staging` / `pnpm build`, then run directly.
    {
      name: 'umattend-staging-client',
      script: '.next/standalone/server.js',
      cwd: './client',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
        OTEL_SERVICE_NAME: 'umattend-client-staging',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4321',
      },
    },
    {
      name: 'umattend-production-client',
      script: '.next/standalone/server.js',
      cwd: './client',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        OTEL_SERVICE_NAME: 'umattend-client',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4320',
      },
    },
  ],
};
