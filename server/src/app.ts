import express, { Response, Request } from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';

import cors from 'cors';
import path from 'path';
import helmet from 'helmet';

import { errorHandler, notFound } from './v1/middlewares/error.middleware';
import { cacheControl } from './v1/middlewares/cacheControl.middleware';
import { metricsMiddleware } from './v1/middlewares/metrics.middleware';
import { requestLogger } from './v1/middlewares/requestLogger.middleware';
import { CustomError } from './v1/interface/error';

import userRoutes from './v1/routes/user.routes';
import authRoutes from './v1/routes/auth.routes';
import eventRoutes from './v1/routes/event.routes';
import docsRoutes from './v1/routes/docs.routes';
import healthRoutes from './v1/routes/health.routes';
import metricsRoutes from './v1/routes/metrics.routes';
import { NODE_ENV, ALLOWED_ORIGINS } from './constants/app.constants';
import register from './telemetry/index';

const app = express();

// ---------- METRICS ENDPOINT (Prometheus scrape — no auth, host-internal only) ----------
// Not proxied by nginx; Prometheus reaches this directly via host.docker.internal:<PORT>
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(String(err));
  }
});

// ---------- SECURITY & PERFORMANCE MIDDLEWARE ----------
app.set('trust proxy', 1);

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

// ---------- REQUEST LOGGER MIDDLEWARE ----------
app.use(requestLogger);

// ---------- REQUEST METRICS MIDDLEWARE ----------
app.use(metricsMiddleware);

// ---------- API ROUTES ----------
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/event', eventRoutes);
app.use('/api/v1/metrics', metricsRoutes);
if (NODE_ENV !== 'PRODUCTION') {
  app.use('/api/v1/docs', docsRoutes);
}

// ---------- SERVE FRONTEND (only in production) ----------
if (NODE_ENV === 'PRODUCTION') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));

  // SPA catch-all: serve index.html for unmatched routes so client-side routing works
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ---------- 404 HANDLER ----------
app.use(notFound);

// ---------- ERROR HANDLER ----------
app.use(errorHandler);

export default app;
