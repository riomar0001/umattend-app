import getEnv from '@/utils/envHandler';

const JWT_ACCESS_TOKEN_SECRET = getEnv('JWT_ACCESS_TOKEN_SECRET');
// All TTLs are a bare number of HOURS, not a timespan string: callers build
// `${TTL}h` for jwt.sign and `Number(TTL) * 60 * 60 * 1000` for cookie maxAge.
// Setting "3h" yields "3hh", which jwt.sign rejects.
const JWT_ACCESS_TOKEN_TTL = getEnv('JWT_ACCESS_TOKEN_TTL');
const JWT_REFRESH_TOKEN_SECRET = getEnv('JWT_REFRESH_TOKEN_SECRET');
const JWT_REFRESH_TOKEN_TTL = getEnv('JWT_REFRESH_TOKEN_TTL');
const JWT_GOOGLE_STATE_SECRET = getEnv('JWT_GOOGLE_STATE_SECRET');
const JWT_ATTENDANCE_TOKEN_SECRET = getEnv('JWT_ATTENDANCE_TOKEN_SECRET');
const JWT_ATTENDANCE_TOKEN_TTL = getEnv('JWT_ATTENDANCE_TOKEN_TTL');

export {
  JWT_ACCESS_TOKEN_SECRET,
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_SECRET,
  JWT_REFRESH_TOKEN_TTL,
  JWT_GOOGLE_STATE_SECRET,
  JWT_ATTENDANCE_TOKEN_SECRET,
  JWT_ATTENDANCE_TOKEN_TTL,
};
