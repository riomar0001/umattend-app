import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimitStore from '../../configs/rateLimit.config';
import { FRONTEND_URL } from '../../constants/app.constants';
import authService from '../services/auth.service';
import { HTTPErrorResponse } from '../../utils/responseHandler';

export const WINDOW_MS = 60_000;
const IP_LIMIT = 300;
const ACCOUNT_LIMIT = 10;

// Refresh endpoint — tokens are long-lived and clients refresh
// automatically, so higher limits to avoid UX friction.
const REFRESH_IP_LIMIT = 1000;
const REFRESH_ACCOUNT_LIMIT = 30;

// Check-in/check-out limits: tuned for fast organizer scanning (a busy
// queue is realistically <2 scans/sec) while still catching automated
// brute-force or QR-iteration attacks.
const CHECKIN_USER_LIMIT = 120; // 120 scans/min per organizer
const CHECKIN_IP_LIMIT = 600; // 600 scans/min per IP (multiple devices)

// The sliding window now lives in a Durable Object rather than a Redis Lua
// script — see src/worker/rateLimiter.do.ts. A DO handles one call at a time,
// so the prune-count-append sequence is atomic for the same reason EVAL was.

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
    return await rateLimitStore.allow(key, WINDOW_MS, limit);
  } catch {
    // Fail open if the store is unavailable
    return true;
  }
}

function getUserIdFromRefreshToken(req: Request): string | undefined {
  const refreshToken =
    (req.cookies?.refresh_token as string) ?? req.body?.refresh_token;
  if (!refreshToken) {
    return undefined;
  }

  try {
    const decoded = jwt.decode(refreshToken) as { user_id?: string } | null;
    return decoded?.user_id;
  } catch {
    return undefined;
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
  const userId = req.user?.id ?? getUserIdFromRefreshToken(req);

  const checks: Promise<boolean>[] = [
    checkSlidingWindow(`rateLimit:ip:${ip}`, IP_LIMIT),
  ];

  if (userId) {
    checks.push(
      checkSlidingWindow(`rateLimit:account:${userId}`, ACCOUNT_LIMIT)
    );
  }

  const results = await Promise.all(checks);

  if (results[0] === false) {
    HTTPErrorResponse(
      res,
      429,
      'Too many requests from this IP. Please try again later.'
    );
    return;
  }

  if (results[1] === false) {
    HTTPErrorResponse(
      res,
      429,
      'Too many requests for this account. Please try again later.'
    );
    return;
  }

  next();
};

// Refresh endpoint — per-IP + per-account with generous IP budget since
// clients refresh automatically. The per-account cap catches token-abuse
// loops while the IP cap prevents one device from starving others.
export const refreshRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const ip = getClientIp(req);
  const userId = req.user?.id ?? getUserIdFromRefreshToken(req);

  const checks: Promise<boolean>[] = [
    checkSlidingWindow(`rateLimit:refresh:ip:${ip}`, REFRESH_IP_LIMIT),
  ];

  if (userId) {
    checks.push(
      checkSlidingWindow(
        `rateLimit:refresh:user:${userId}`,
        REFRESH_ACCOUNT_LIMIT
      )
    );
  }

  const results = await Promise.all(checks);

  if (results[0] === false) {
    HTTPErrorResponse(
      res,
      429,
      'Too many refresh requests from this IP. Please try again later.'
    );
    return;
  }

  if (results[1] === false) {
    HTTPErrorResponse(
      res,
      429,
      'Too many refresh requests for this account. Please try again later.'
    );
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
    IP_LIMIT
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

    HTTPErrorResponse(
      res,
      429,
      'Too many OAuth requests. Please try again later.'
    );
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
  const userId = req.user?.id;

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
    HTTPErrorResponse(
      res,
      429,
      'Too many scan requests from this IP. Please slow down.'
    );
    return;
  }

  if (results[1] === false) {
    HTTPErrorResponse(
      res,
      429,
      'Too many scan requests for this account. Please slow down.'
    );
    return;
  }

  next();
};

export default oauthRateLimiter;
