import express from 'express';
import cookieParser from 'cookie-parser';

import cors from 'cors';
import helmet from 'helmet';

import { errorHandler, notFound } from './v1/middlewares/error.middleware';
import { cacheControl } from './v1/middlewares/cacheControl.middleware';
import { CustomError } from './v1/interface/error';

import userRoutes from './v1/routes/user.routes';
import authRoutes from './v1/routes/auth.routes';
import eventRoutes from './v1/routes/event.routes';
import adminRoutes from './v1/routes/admin.routes';
import docsRoutes from './v1/routes/docs.routes';
import healthRoutes from './v1/routes/health.routes';
import { NODE_ENV, ALLOWED_ORIGINS } from './constants/app.constants';

const app = express();

// The Prometheus /metrics endpoint is gone along with the rest of the LGTM
// stack: prom-client and the OpenTelemetry Node SDK cannot run on workerd, and
// nothing would scrape a Worker over host-internal networking anyway.
// Observability now comes from Workers Logs — see the `observability` block in
// wrangler.jsonc and `wrangler tail`.

// ---------- SECURITY & PERFORMANCE MIDDLEWARE ----------
app.set('trust proxy', 1);

// Express derives `env` from process.env.NODE_ENV and compares it to the exact
// lowercase string 'production'. This app's NODE_ENV is 'PRODUCTION' /
// 'STAGING' / 'DEVELOPMENT', so that comparison never matched and Express ran
// in development mode in production — which is what makes its built-in
// `finalhandler` serialise stack traces and absolute file paths into the
// response body. Normalised here rather than by renaming the variable, because
// NODE_ENV's uppercase form is read all over the codebase.
app.set('env', NODE_ENV === 'DEVELOPMENT' ? 'development' : 'production');

// Disable CSP for documentation routes in dev/staging
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cacheControl);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- CORS CONFIGURATION ----------
const allowedOrigins = ALLOWED_ORIGINS.split(',').map((origin: string) =>
  origin.trim()
);

app.use(
  cors({
    origin: (origin: string | undefined, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.error(`Blocked by CORS: ${origin}`);
        const err = new Error('Forbidden') as CustomError;
        err.statusCode = 403;
        callback(err);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

// ---------- API ROUTES ----------
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/event', eventRoutes);
app.use('/api/v1/admin', adminRoutes);
if (NODE_ENV !== 'PRODUCTION') {
  app.use('/api/v1/docs', docsRoutes);
}

// The frontend is no longer served from here. Workers have no filesystem for
// `express.static`, and the client is published separately — Vercel serves it
// and proxies /api back to this Worker (see client/DEPLOYMENT.md).

// ---------- 404 HANDLER ----------
app.use(notFound);

// ---------- ERROR HANDLER ----------
app.use(errorHandler);

export default app;
