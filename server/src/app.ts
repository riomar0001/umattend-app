import express, { Response, Request } from 'express';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';

import cors from 'cors';
import path from 'path';
import helmet from 'helmet';

import { errorHandler, notFound } from './v1/middlewares/error.middleware';
import { cacheControl } from './v1/middlewares/cacheControl.middleware';
import { metricsMiddleware } from './v1/middlewares/metrics.middleware';

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
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
);

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

  app.use((req: Request, res: Response) => {
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const asciiArt = `
                                                                                                                                                                                                
                                                                                                                                                                                                
UUUUUUUU     UUUUUUUUMMMMMMMM               MMMMMMMM               AAA         TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTEEEEEEEEEEEEEEEEEEEEEENNNNNNNN        NNNNNNNNDDDDDDDDDDDDD        
U::::::U     U::::::UM:::::::M             M:::::::M              A:::A        T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN:::::::N       N::::::ND::::::::::::DDD     
U::::::U     U::::::UM::::::::M           M::::::::M             A:::::A       T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN::::::::N      N::::::ND:::::::::::::::DD   
UU:::::U     U:::::UUM:::::::::M         M:::::::::M            A:::::::A      T:::::TT:::::::TT:::::TT:::::TT:::::::TT:::::TEE::::::EEEEEEEEE::::EN:::::::::N     N::::::NDDD:::::DDDDD:::::D  
 U:::::U     U:::::U M::::::::::M       M::::::::::M           A:::::::::A     TTTTTT  T:::::T  TTTTTTTTTTTT  T:::::T  TTTTTT  E:::::E       EEEEEEN::::::::::N    N::::::N  D:::::D    D:::::D 
 U:::::D     D:::::U M:::::::::::M     M:::::::::::M          A:::::A:::::A            T:::::T                T:::::T          E:::::E             N:::::::::::N   N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M:::::::M::::M   M::::M:::::::M         A:::::A A:::::A           T:::::T                T:::::T          E::::::EEEEEEEEEE   N:::::::N::::N  N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M M::::M M::::M M::::::M        A:::::A   A:::::A          T:::::T                T:::::T          E:::::::::::::::E   N::::::N N::::N N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M  M::::M::::M  M::::::M       A:::::A     A:::::A         T:::::T                T:::::T          E:::::::::::::::E   N::::::N  N::::N:::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M   M:::::::M   M::::::M      A:::::AAAAAAAAA:::::A        T:::::T                T:::::T          E::::::EEEEEEEEEE   N::::::N   N:::::::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M    M:::::M    M::::::M     A:::::::::::::::::::::A       T:::::T                T:::::T          E:::::E             N::::::N    N::::::::::N  D:::::D     D:::::D
 U::::::U   U::::::U M::::::M     MMMMM     M::::::M    A:::::AAAAAAAAAAAAA:::::A      T:::::T                T:::::T          E:::::E       EEEEEEN::::::N     N:::::::::N  D:::::D    D:::::D 
 U:::::::UUU:::::::U M::::::M               M::::::M   A:::::A             A:::::A   TT:::::::TT            TT:::::::TT      EE::::::EEEEEEEE:::::EN::::::N      N::::::::NDDD:::::DDDDD:::::D  
  UU:::::::::::::UU  M::::::M               M::::::M  A:::::A               A:::::A  T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N       N:::::::ND:::::::::::::::DD   
    UU:::::::::UU    M::::::M               M::::::M A:::::A                 A:::::A T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N        N::::::ND::::::::::::DDD     
      UUUUUUUUU      MMMMMMMM               MMMMMMMMAAAAAAA                   AAAAAAATTTTTTTTTTT            TTTTTTTTTTT      EEEEEEEEEEEEEEEEEEEEEENNNNNNNN         NNNNNNNDDDDDDDDDDDDD  
  
───────────────────────────────────────────────────────────────────────────────
   Server running in PRODUCTION mode
   Date/Time: ${now}
───────────────────────────────────────────────────────────────────────────────
      `;
    res.type('text/plain').send(asciiArt);
  });
}

if (NODE_ENV !== 'PRODUCTION') {
  app.use((req: Request, res: Response) => {
    const now = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
    const asciiArt = `
                                                                                                                                                                                                
                                                                                                                                                                                                
UUUUUUUU     UUUUUUUUMMMMMMMM               MMMMMMMM               AAA         TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTEEEEEEEEEEEEEEEEEEEEEENNNNNNNN        NNNNNNNNDDDDDDDDDDDDD        
U::::::U     U::::::UM:::::::M             M:::::::M              A:::A        T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN:::::::N       N::::::ND::::::::::::DDD     
U::::::U     U::::::UM::::::::M           M::::::::M             A:::::A       T:::::::::::::::::::::TT:::::::::::::::::::::TE::::::::::::::::::::EN::::::::N      N::::::ND:::::::::::::::DD   
UU:::::U     U:::::UUM:::::::::M         M:::::::::M            A:::::::A      T:::::TT:::::::TT:::::TT:::::TT:::::::TT:::::TEE::::::EEEEEEEEE::::EN:::::::::N     N::::::NDDD:::::DDDDD:::::D  
 U:::::U     U:::::U M::::::::::M       M::::::::::M           A:::::::::A     TTTTTT  T:::::T  TTTTTTTTTTTT  T:::::T  TTTTTT  E:::::E       EEEEEEN::::::::::N    N::::::N  D:::::D    D:::::D 
 U:::::D     D:::::U M:::::::::::M     M:::::::::::M          A:::::A:::::A            T:::::T                T:::::T          E:::::E             N:::::::::::N   N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M:::::::M::::M   M::::M:::::::M         A:::::A A:::::A           T:::::T                T:::::T          E::::::EEEEEEEEEE   N:::::::N::::N  N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M M::::M M::::M M::::::M        A:::::A   A:::::A          T:::::T                T:::::T          E:::::::::::::::E   N::::::N N::::N N::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M  M::::M::::M  M::::::M       A:::::A     A:::::A         T:::::T                T:::::T          E:::::::::::::::E   N::::::N  N::::N:::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M   M:::::::M   M::::::M      A:::::AAAAAAAAA:::::A        T:::::T                T:::::T          E::::::EEEEEEEEEE   N::::::N   N:::::::::::N  D:::::D     D:::::D
 U:::::D     D:::::U M::::::M    M:::::M    M::::::M     A:::::::::::::::::::::A       T:::::T                T:::::T          E:::::E             N::::::N    N::::::::::N  D:::::D     D:::::D
 U::::::U   U::::::U M::::::M     MMMMM     M::::::M    A:::::AAAAAAAAAAAAA:::::A      T:::::T                T:::::T          E:::::E       EEEEEEN::::::N     N:::::::::N  D:::::D    D:::::D 
 U:::::::UUU:::::::U M::::::M               M::::::M   A:::::A             A:::::A   TT:::::::TT            TT:::::::TT      EE::::::EEEEEEEE:::::EN::::::N      N::::::::NDDD:::::DDDDD:::::D  
  UU:::::::::::::UU  M::::::M               M::::::M  A:::::A               A:::::A  T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N       N:::::::ND:::::::::::::::DD   
    UU:::::::::UU    M::::::M               M::::::M A:::::A                 A:::::A T:::::::::T            T:::::::::T      E::::::::::::::::::::EN::::::N        N::::::ND::::::::::::DDD     
      UUUUUUUUU      MMMMMMMM               MMMMMMMMAAAAAAA                   AAAAAAATTTTTTTTTTT            TTTTTTTTTTT      EEEEEEEEEEEEEEEEEEEEEENNNNNNNN         NNNNNNNDDDDDDDDDDDDD  
  
───────────────────────────────────────────────────────────────────────────────
   Server running in DEVELOPMENT mode
   Date/Time: ${now}
───────────────────────────────────────────────────────────────────────────────
      `;
    res.type('text/plain').send(asciiArt);
  });
}

// ---------- 404 HANDLER ----------
app.use(notFound);

// ---------- ERROR HANDLER ----------
app.use(errorHandler);

export default app;
