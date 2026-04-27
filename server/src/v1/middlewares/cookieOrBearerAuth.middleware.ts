import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_ACCESS_TOKEN_SECRET } from '@/constants/jwt.constants';
import { HTTPErrorResponse } from '@/utils/responseHandler';

/**
 * Auth middleware that accepts a JWT from either the access_token httpOnly
 * cookie (browser login flow) or an Authorization: Bearer header (API clients).
 * Cookie takes priority so browser sessions work without extra headers.
 */
export const cookieOrBearerAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token =
    (req.cookies?.access_token as string | undefined) ??
    req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    HTTPErrorResponse(res, 401, 'Authentication required');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_TOKEN_SECRET) as {
      user_id: string;
      umindanao_email: string;
      role: string;
      done_onboarding: boolean;
    };

    req.user = {
      id: decoded.user_id,
      umindanao_email: decoded.umindanao_email,
      role: decoded.role,
      done_onboarding: decoded.done_onboarding,
    };

    next();
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      HTTPErrorResponse(res, 401, 'Access token expired');
      return;
    }
    HTTPErrorResponse(res, 403, 'Invalid token');
  }
};
