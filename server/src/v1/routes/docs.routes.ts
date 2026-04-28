import express from 'express';
import { apiReference } from '@scalar/express-api-reference';
import { NODE_ENV } from '@/constants/app.constants';
import { auth } from '../docs/auth.docs';
import { user } from '../docs/user.docs';
import { event } from '../docs/event.docs';
import { admin } from '../docs/admin.docs';
import { Request, Response } from 'express';
import { FRONTEND_URL } from '@/constants/app.constants';

const router = express.Router();

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'UMAttend API',
    version: '1.0.0',
    description:
      'API documentation for the UMAttend application.\n\nTo obtain a token, please log in through the frontend application. After logging in, retrieve the access token and refresh token from your browser’s storage.',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'API v1',
    },
  ],
  externalDocs: {
    description: 'Open UMAttend Frontend',
    url: FRONTEND_URL,
  },
  paths: {
    ...auth,
    ...user,
    ...event,
    ...admin,
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token',
      },
    },
  },
};

if (NODE_ENV === 'PRODUCTION') {
  router.use((req: Request, res: Response) => {
    res.status(403).json({
      error: 'Documentation is not available in production environment',
    });
  });
}

router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openApiSpec);
});

router.use(
  '/',
  apiReference({
    theme: 'deepSpace',
    spec: {
      content: openApiSpec,
    },
  } as Parameters<typeof apiReference>[0])
);

export default router;
