// PM2 process config — used by both staging and prod.
// Secrets (DATABASE_URL, JWT_SECRET, etc.) must be set in the shell env or a .env file
// before starting any process.
//
// Build first:
//   cd server && npm run build && cd ..
//   cd client && npm run build && cd ..
//
// Start all processes:
//   pm2 start ecosystem.config.cjs
//
// Start staging only:
//   pm2 start ecosystem.config.cjs --only umattend-staging-server,umattend-staging-client
//
// Start production only:
//   pm2 start ecosystem.config.cjs --only umattend-production-server,umattend-production-client
//
// Restart after a new build:
//   pm2 restart umattend-staging-server umattend-staging-client
//   pm2 restart umattend-production-server umattend-production-client
//
// View logs:
//   pm2 logs umattend-staging-client
//   pm2 logs umattend-staging-server
module.exports = {
  apps: [
    {
      name: 'umattend-staging-server',
      script: 'npm',
      args: 'start',
      cwd: './server',
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
    {
      name: 'umattend-staging-client',
      script: 'npm',
      args: 'start',
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
