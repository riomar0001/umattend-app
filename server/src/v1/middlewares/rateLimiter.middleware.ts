import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import redis from '../../configs/redis.config';
import { FRONTEND_URL } from '../../constants/app.constants';
import authService from '../services/auth.service';

const WINDOW_MS = 60_000;
const IP_LIMIT = 300;
const ACCOUNT_IP_LIMIT = 10;

// Check-in/check-out limits: tuned for fast organizer scanning (a busy
// queue is realistically <2 scans/sec) while still catching automated
// brute-force or QR-iteration attacks.
const CHECKIN_USER_LIMIT = 120; // 120 scans/min per organizer
const CHECKIN_IP_LIMIT = 600; // 600 scans/min per IP (multiple devices)

// Atomic sliding window via Redis sorted set
const slidingWindowScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local uid = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)

if count >= limit then
  return 0
end

redis.call('ZADD', key, now, uid)
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 1)

return 1
`;

function getClientIp(req: Request): string {
  // CF-Connecting-IP is set by Cloudflare. Only trust it when the request
  // actually came through our Cloudflare edge — `req.ip` reflects that
  // because Express resolves it via the configured `trust proxy` setting.
  // In other environments (direct access, internal tools, staging) we
  // ignore CF-Connecting-IP because any client could spoof it.
  const cfIp = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIp && req.ip) {
    return cfIp.trim();
  }

  // Otherwise fall back to Express's resolved IP — with `trust proxy` set,
  // this honours X-Forwarded-For only when it comes from a trusted hop.
  return req.ip ?? 'unknown';
}

async function checkSlidingWindow(
  key: string,
  limit: number
): Promise<boolean> {
  try {
    const result = await redis.eval(
      slidingWindowScript,
      1,
      key,
      String(Date.now()),
      String(WINDOW_MS),
      String(limit),
      randomUUID()
    );
    return result === 1;
  } catch {
    // Fail open if Redis is unavailable
    return true;
  }
}

// Both counters run in parallel — both must pass for the request to proceed.
// Per-IP blocks mass scanning across many accounts; per-account blocks
// targeted brute-force from many IPs against a single account.
export const loginRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const ip = getClientIp(req);
  const userId = (req as Request & { user?: { id: string } }).user?.id;

  const checks: Promise<boolean>[] = [
    checkSlidingWindow(`rateLimit:ip:${ip}`, IP_LIMIT),
  ];

  if (userId) {
    checks.push(
      checkSlidingWindow(`rateLimit:account:${userId}`, ACCOUNT_IP_LIMIT)
    );
  }

  const results = await Promise.all(checks);

  if (results[0] === false) {
    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many requests from this IP. Please try again later.',
    });
    return;
  }

  if (results[1] === false) {
    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many requests for this account. Please try again later.',
    });
    return;
  }

  next();
};

// OAuth routes — same window limits with redirect/error-code handling
export const oauthRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const allowed = await checkSlidingWindow(
    `rateLimit:oauth:${getClientIp(req)}`,
    ACCOUNT_IP_LIMIT
  );

  if (!allowed) {
    if (req.originalUrl.includes('/exchange')) {
      const errorMessage =
        'Too Many Exchange Attempts. Please try again later.';
      const error_code = await authService.generateErrorCode(errorMessage);
      res
        .status(429)
        .json({ status: 'error', message: errorMessage, error_code });
      return;
    }

    if (req.originalUrl.includes('/google/callback')) {
      const errorMessage = 'Too Many Login Attempts. Please try again later.';
      const error_code = await authService.generateErrorCode(errorMessage);
      res.redirect(`${FRONTEND_URL}/?error_code=${error_code}`);
      return;
    }

    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many OAuth requests. Please try again later.',
    });
    return;
  }

  next();
};

// Per-user + per-IP limiter for check-in/check-out scan endpoints. Sits
// after authMiddleware so we always have a user id.
export const checkInRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const ip = getClientIp(req);
  const userId = (req as Request & { user?: { id: string } }).user?.id;

  const checks: Promise<boolean>[] = [
    checkSlidingWindow(`rateLimit:checkin:ip:${ip}`, CHECKIN_IP_LIMIT),
  ];

  if (userId) {
    checks.push(
      checkSlidingWindow(`rateLimit:checkin:user:${userId}`, CHECKIN_USER_LIMIT)
    );
  }

  const results = await Promise.all(checks);

  if (results[0] === false) {
    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many scan requests from this IP. Please slow down.',
    });
    return;
  }

  if (results[1] === false) {
    res.status(429).json({
      status: 429,
      success: false,
      message: 'Too many scan requests for this account. Please slow down.',
    });
    return;
  }

  next();
};

export default oauthRateLimiter;
