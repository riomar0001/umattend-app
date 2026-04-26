import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import redis from '../../configs/redis.config';
import { FRONTEND_URL } from '../../constants/app.constants';
import authService from '../services/auth.service';

const WINDOW_MS = 60_000;
const IP_LIMIT = 300;
const ACCOUNT_IP_LIMIT = 10;

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
  // CF-Connecting-IP is set by Cloudflare and is the most reliable real-visitor
  // IP when the stack is Cloudflare → Nginx → Express.
  const cfIp = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIp) {
    return cfIp.trim();
  }

  // Fallback: leftmost entry of X-Forwarded-For (added by Nginx/proxies)
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  return forwarded?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
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

export default oauthRateLimiter;
