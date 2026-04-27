// PM2 process config — used by both staging and prod.
// Secrets (DATABASE_URL, JWT_SECRET, etc.) must be set in the shell env or a .env file
// loaded before running: pm2 start ecosystem.config.cjs --env staging|production
module.exports = {
  apps: [
    {
      name: 'umattend-server-staging',
      script: 'dist/server.js',
      cwd: './server',
      // --import loads tracing.ts output before any other module so OTel
      // instrumentation patches Express/HTTP before they are imported.
      node_args: '--import ./dist/telemetry/tracing.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 4001,
        OTEL_SERVICE_NAME: 'umattend-server-staging',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      },
    },
    {
      name: 'umattend-server-prod',
      script: 'dist/server.js',
      cwd: './server',
      node_args: '--import ./dist/telemetry/tracing.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        OTEL_SERVICE_NAME: 'umattend-server',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4320',
      },
    },
    // Next.js calls instrumentation.ts register() automatically — no --import needed.
    // Standalone output: built by `pnpm build:staging` / `pnpm build`, then run directly.
    {
      name: 'umattend-client-staging',
      script: '.next/standalone/server.js',
      cwd: './client',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_staging: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOSTNAME: '127.0.0.1',
        OTEL_SERVICE_NAME: 'umattend-client-staging',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
      },
    },
    {
      name: 'umattend-client-prod',
      script: '.next/standalone/server.js',
      cwd: './client',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '127.0.0.1',
        OTEL_SERVICE_NAME: 'umattend-client',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4320',
      },
    },
  ],
};
