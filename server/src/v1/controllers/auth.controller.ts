import authService from '../services/auth.service';
import { Request, Response } from 'express';
import GoogleAuth from '../services/google.service';
import {
  HTTPErrorResponse,
  HTTPSuccessResponse,
} from '../../utils/responseHandler';
import jwt from 'jsonwebtoken';
import { AuthenticationError, NotFoundError } from '../../utils/customErrors';
import { FRONTEND_URL, NODE_ENV } from '../../constants/app.constants';
import {
  JWT_ACCESS_TOKEN_TTL,
  JWT_REFRESH_TOKEN_TTL,
} from '@/constants/jwt.constants';

function getClientIp(req: Request): string {
  // CF-Connecting-IP is set by Cloudflare and is the most reliable real-visitor
  // IP when the stack is Cloudflare → Nginx → Express.
  const cfIp = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIp) return cfIp.trim();

  // Fallback: leftmost entry of X-Forwarded-For (added by Nginx/proxies)
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  return forwarded?.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
}

const googleAuth = async (req: Request, res: Response) => {
  try {
    const url = GoogleAuth.generateGoogleAuthUrl();

    return res.redirect(url);
  } catch (error: unknown) {
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const googleCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    const currentUri = `${req.protocol}://${req.get('host')}${
      req.originalUrl.split('?')[0]
    }`;

    const frontendUrl = FRONTEND_URL;

    if (!code) {
      const error_code = await authService.generateErrorCode(
        'Missing authorization code'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    if (!GoogleAuth.validateRedirectUri(currentUri)) {
      const error_code = await authService.generateErrorCode(
        'Invalid redirect URI'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    if (!GoogleAuth.validateState(state as string)) {
      const error_code = await authService.generateErrorCode(
        'Invalid state parameter'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    const result = await authService.googleAuthWithCode(
      code as string,
      state as string,
      getClientIp(req),
      req.headers['user-agent'] ?? ''
    );

    const auth_code = await authService.generateAuthCode(
      result.access_token,
      result.refresh_token
    );

    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: NODE_ENV === 'PRODUCTION',
      sameSite: 'strict',
      maxAge: Number(JWT_ACCESS_TOKEN_TTL) * 60 * 60 * 1000,
    });

    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: NODE_ENV === 'PRODUCTION',
      sameSite: 'strict',
      maxAge: Number(JWT_REFRESH_TOKEN_TTL) * 60 * 60 * 1000,
    });

    return res.redirect(`${frontendUrl}/?auth_code=${auth_code}`);
  } catch (error: unknown) {
    const frontendUrl = FRONTEND_URL ?? 'http://localhost:3000';

    const error_code = await authService.generateErrorCode(
      'Internal server error'
    );

    if (error instanceof jwt.TokenExpiredError) {
      const error_code = await authService.generateErrorCode(
        'Internal server error'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
  }
};

const logoutUser = async (req: Request, res: Response) => {
  try {
    const refresh_token = req.body?.refresh_token;
    const cookieRefreshToken = req.cookies?.refresh_token;

    const finalRefreshToken = refresh_token ?? cookieRefreshToken;

    if (finalRefreshToken) {
      await authService.logoutUser(finalRefreshToken);
    }

    if (req.cookies['refresh_token']) {
      res.clearCookie('refresh_token');
    }

    if (req.cookies['access_token']) {
      res.clearCookie('access_token');
    }

    return HTTPSuccessResponse(res, 200, 'Logged out successfully') as Response;
  } catch (error: unknown) {
    console.log(error);
    if (NODE_ENV === 'DEVELOPMENT') {
      if (error instanceof jwt.JsonWebTokenError) {
        return HTTPErrorResponse(res, 400, error.message) as Response;
      }
    }

    if (error instanceof jwt.TokenExpiredError) {
      return HTTPErrorResponse(res, 401, 'Token Expire') as Response;
    }

    if (error instanceof AuthenticationError) {
      return HTTPErrorResponse(res, 401, 'Authentication Error') as Response;
    }

    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, 'Not Found') as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const refreshAccessToken = async (req: Request, res: Response) => {
  try {
    const refresh_token = req.cookies.refresh_token ?? req.body.refresh_token;

    if (!refresh_token) {
      return HTTPErrorResponse(
        res,
        400,
        'Refresh token is required'
      ) as Response;
    }

    const accessToken = await authService.refreshAccessToken(refresh_token);

    return HTTPSuccessResponse(
      res,
      200,
      'Access Token Refreshed Successfully',
      {
        access_token: accessToken,
      }
    ) as Response;
  } catch (error: unknown) {
    if (NODE_ENV === 'DEVELOPMENT') {
      if (error instanceof jwt.JsonWebTokenError) {
        return HTTPErrorResponse(res, 400, error.message) as Response;
      }
    }

    console.log(error);

    if (error instanceof jwt.TokenExpiredError) {
      return HTTPErrorResponse(res, 401, 'Token Expire') as Response;
    }

    if (error instanceof AuthenticationError) {
      return HTTPErrorResponse(res, 401, 'Authentication Error') as Response;
    }

    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, 'Not Found') as Response;
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const exhangeCode = async (req: Request, res: Response) => {
  try {
    if (!req.body) {
      return HTTPErrorResponse(res, 400, 'Missing request body') as Response;
    }

    const { auth_code, error_code } = req.body;

    if (!auth_code && !error_code) {
      return HTTPErrorResponse(res, 400, 'Missing exchange code') as Response;
    }

    let response: object = {};
    let response_message: string = '';

    if (auth_code) {
      const tokens = await authService.getDataFromAuthCode(auth_code);

      const { access_token, refresh_token } = tokens;

      response = { access_token, refresh_token };
      response_message = 'Tokens retrieved';
    }

    if (error_code) {
      const error_message = await authService.getDataFromErrorCode(error_code);
      response_message = 'Error during authentication';
      response = { error_message };

      if (error_message) {
        return HTTPErrorResponse(res, 400, error_message) as Response;
      }
    }

    return HTTPSuccessResponse(
      res,
      200,
      response_message,
      response
    ) as Response;
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message) as Response;
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getLoginHistory = async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id;
    const login_history = await authService.getLoginHistory(user_id);
    return HTTPSuccessResponse(res, 200, 'Login history retrieved', {
      login_history,
    }) as Response;
  } catch (error: unknown) {
    console.log(error);

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error:${error}`
      ) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const authController = {
  googleAuth,
  googleCallback,
  logoutUser,
  refreshAccessToken,
  exhangeCode,
  getLoginHistory,
};

export default authController;
