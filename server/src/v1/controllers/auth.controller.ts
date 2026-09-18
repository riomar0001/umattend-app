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
import { clientIp } from '@/utils/clientIp';
import { locationFromRequest } from '@/utils/geoHeaders';
import {
  accessTokenCookie,
  refreshTokenCookie,
  clearCookieOptions,
} from '../../utils/authCookies';

const googleAuth = async (req: Request, res: Response) => {
  try {
    const url = GoogleAuth.generateGoogleAuthUrl();

    return res.redirect(url);
  } catch (error: unknown) {
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(
        res,
        500,
        `Internal server error: ${error}`
      ) as Response;
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

    // Each failure below is logged as well as handed back as an error_code.
    // That code lives 60s in the ephemeral store and is destroyed on first
    // read, so it is useless for diagnosing a failure after the fact —
    // Workers Logs are. Keep the user-facing message generic, log the detail.
    if (!code) {
      console.error('[google/callback] missing authorization code', {
        currentUri,
        query: Object.keys(req.query),
      });
      const error_code = await authService.generateErrorCode(
        'Missing authorization code'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    if (!GoogleAuth.validateRedirectUri(currentUri)) {
      console.error('[google/callback] redirect URI rejected', { currentUri });
      const error_code = await authService.generateErrorCode(
        'Invalid redirect URI'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    if (!GoogleAuth.validateState(state as string)) {
      console.error('[google/callback] state validation failed', {
        statePresent: Boolean(state),
      });
      const error_code = await authService.generateErrorCode(
        'Invalid state parameter'
      );
      return res.redirect(`${frontendUrl}/?error_code=${error_code}`);
    }

    const result = await authService.googleAuthWithCode(
      code as string,
      state as string,
      clientIp(req),
      req.headers['user-agent'] ?? '',
      locationFromRequest(req)
    );

    const auth_code = await authService.generateAuthCode(
      result.access_token,
      result.refresh_token
    );

    res.cookie('access_token', result.access_token, accessTokenCookie());
    res.cookie('refresh_token', result.refresh_token, refreshTokenCookie());

    // Confirms the code was minted and where the browser is being sent — the
    // two things that determine whether the client can exchange it.
    console.log('[google/callback] issued auth_code', {
      auth_code_prefix: auth_code.slice(0, 8),
      redirect_to: `${frontendUrl}/?auth_code=…`,
      has_access_token: Boolean(result.access_token),
      has_refresh_token: Boolean(result.refresh_token),
    });

    return res.redirect(`${frontendUrl}/?auth_code=${auth_code}`);
  } catch (error: unknown) {
    const frontendUrl = FRONTEND_URL ?? 'http://localhost:3000';

    // Without this the cause is lost entirely: the user only ever sees
    // 'Internal server error', and the error_code carrying it is gone 60s later.
    console.error('[google/callback] unhandled failure', {
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const error_code = await authService.generateErrorCode(
      'Internal server error'
    );

    if (error instanceof jwt.TokenExpiredError) {
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

    // Must carry the same domain/path the cookie was set with, or the browser
    // treats it as a different cookie and logout leaves the session behind.
    if (req.cookies['refresh_token']) {
      res.clearCookie('refresh_token', clearCookieOptions());
    }

    if (req.cookies['access_token']) {
      res.clearCookie('access_token', clearCookieOptions());
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
      return HTTPErrorResponse(res, 401, 'Token Expired') as Response;
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
        `Internal server error: ${error}`
      ) as Response;
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
      return HTTPErrorResponse(res, 401, 'Token Expired') as Response;
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
        `Internal server error: ${error}`
      ) as Response;
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
        `Internal server error: ${error}`
      ) as Response;
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
        `Internal server error: ${error}`
      ) as Response;
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
