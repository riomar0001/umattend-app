import getEnv from '@/utils/envHandler';

// PORT / HOST / DATABASE_URL are gone: a Worker does not bind a port, and the
// database is reached through the D1 binding rather than a connection string.
const NODE_ENV = getEnv('NODE_ENV');
const FRONTEND_URL = getEnv('FRONTEND_URL');
const ALLOWED_ORIGINS = getEnv('ALLOWED_ORIGINS');

export { NODE_ENV, FRONTEND_URL, ALLOWED_ORIGINS };
