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
// The two server apps are gone: the API runs on Cloudflare Workers now, not
// pm2. `server/` no longer has a Node entry point — it is deployed with
// `npm run deploy:staging` / `deploy:prod` from ./server. Only the Next.js
// client still runs here.
module.exports = {
  apps: [
    {
      name: "umattend-staging-client",
      script: "npm",
      args: "start",
      cwd: "./client",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        HOSTNAME: "127.0.0.1",      },
    },
    {
      name: "umattend-production-client",
      script: "npm",
      args: "start",
      cwd: "./client",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",      },
    },
  ],
};
