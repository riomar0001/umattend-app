import GoogleAuth from '../services/google.service.js';
import authRepository from '../repositories/auth.repository.js';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import {
  generateAccessToken,
  generateRefreshToken,
} from '@/v1/services/jwt.service.js';
import {
  EmptyTokenError,
  AuthenticationError,
  NotFoundError,
} from '../../utils/customErrors';
import { verifyHashedRefreshToken } from '../../utils/tokenHashing.js';
import { RefreshTokenPayload } from '../interface/token.js';
import crypto from 'crypto';
import { JWT_REFRESH_TOKEN_SECRET } from '@/constants/jwt.constants.js';

import { sanitizeKey, extractStudentID } from '@/utils/string.utils.js';

const googleAuthWithCode = async (
  code: string,
  state: string,
  ip_address: string,
  userAgent: string
) => {
  const googleUser = await GoogleAuth.exchangeCodeForUserInfo(code, state);

  let user = await authRepository.findUserByGoogleId(googleUser.google_id);

  if (!user) {
    const student_id = Number(extractStudentID(googleUser.email));
    try {
      user = await authRepository.createUser({
        umindanao_email: googleUser.email,
        google_id: googleUser.google_id,
        role: 'student',
        student_id: student_id,
        name: googleUser.name,
        profile_picture: googleUser.profile_picture,
      });
    } catch (error) {
      // A concurrent OAuth callback created the user first — fetch the existing row
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        user = await authRepository.findUserByGoogleId(googleUser.google_id);
        if (!user) {
          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  await authRepository.updateLoginAndProfile(
    user.id,
    googleUser.profile_picture
  );

  const access_token = generateAccessToken({
    user_id: user.id,
    umindanao_email: user.umindanao_email,
    role: user.role,
    done_onboarding: user.done_onboarding,
    student_id: Number(user.student?.student_id),
    name: user.student?.name,
    department: user.student?.department ?? '',
    program: user.student?.program ?? '',
    profile_picture: user.student?.profile_picture ?? '',
  });

  const refresh_token = await generateRefreshToken(
    user.id,
    ip_address,
    userAgent
  );

  return { access_token, refresh_token, user };
};

const refreshAccessToken = async (refresh_token: string) => {
  let token: RefreshTokenPayload;

  let expiredAt: Date | undefined;

  try {
    token = jwt.verify(
      refresh_token,
      JWT_REFRESH_TOKEN_SECRET
    ) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      expiredAt = error.expiredAt;

      throw new jwt.TokenExpiredError('Refresh token has expired', expiredAt);
    }

    throw new AuthenticationError('Invalid refresh token format');
  }

  const verifyTokenDBExist = await authRepository.verifyRefreshToken(
    token.token_id
  );

  if (!verifyTokenDBExist) {
    throw new NotFoundError('Refresh token not found');
  }

  if (!verifyTokenDBExist.is_active) {
    throw new AuthenticationError('Refresh token has been revoked');
  }

  if (new Date(verifyTokenDBExist.expires_at) < new Date()) {
    throw new jwt.TokenExpiredError(
      'Refresh token has expired',
      verifyTokenDBExist.expires_at
    );
  }

  const validateHashedToken = await verifyHashedRefreshToken(
    refresh_token,
    verifyTokenDBExist.token_hash
  );

  if (!validateHashedToken) {
    throw new AuthenticationError('Invalid refresh token');
  }

  const user = await authRepository.getUserById(token.user_id);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return generateAccessToken({
    user_id: user.id,
    umindanao_email: user.id,
    role: user.id,
    student_id: user.student?.student_id as number,
    name: user.student?.name as string,
    department: user.student?.department as string,
    program: user.student?.program as string,
  });
};

const logoutUser = async (refresh_token: string) => {
  if (!refresh_token) {
    throw new EmptyTokenError('Refresh token is required');
  }

  let verifyToken: RefreshTokenPayload;

  try {
    verifyToken = jwt.verify(
      refresh_token,
      JWT_REFRESH_TOKEN_SECRET
    ) as RefreshTokenPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new jwt.TokenExpiredError(
        'Refresh token has expired',
        error.expiredAt
      );
    }
    throw new AuthenticationError('Invalid refresh token format');
  }

  // Fetch token record only to validate the hash — is_active/expires_at are
  // checked atomically inside revokeRefreshToken's transaction to avoid TOCTOU
  // with the cron cleanup job.
  const tokenRecord = await authRepository.verifyRefreshToken(
    verifyToken.token_id
  );

  if (!tokenRecord) {
    throw new NotFoundError('Refresh token not found');
  }

  const validateHashedToken = await verifyHashedRefreshToken(
    refresh_token,
    tokenRecord.token_hash
  );

  if (!validateHashedToken) {
    throw new AuthenticationError('Invalid refresh token');
  }

  const revoked = await authRepository.revokeRefreshToken(verifyToken.token_id);

  if (!revoked) {
    throw new AuthenticationError('Refresh token has already been revoked');
  }
};

const generateErrorCode = async (error_message: string) => {
  const error_code = crypto.randomBytes(32).toString('hex');
  await authRepository.createErrorCode(error_code, error_message);
  return error_code;
};

const generateAuthCode = async (
  access_token: string,
  refresh_token: string
) => {
  const auth_code = crypto.randomBytes(32).toString('hex');
  await authRepository.createAuthCode(auth_code, access_token, refresh_token);
  return auth_code;
};

const getDataFromErrorCode = async (error_code: string) => {
  const sanitizedErrorCode = sanitizeKey(error_code);
  // getErrorCode uses GETDEL — atomic read-and-remove prevents double-redemption
  const error = await authRepository.getErrorCode(sanitizedErrorCode);
  if (!error) {
    throw new NotFoundError('Error code not found');
  }
  const { error_message } = JSON.parse(error);
  return error_message;
};

const getDataFromAuthCode = async (auth_code: string) => {
  const sanitizedAuthCode = sanitizeKey(auth_code);
  // getAuthCode uses GETDEL — atomic read-and-remove prevents double-redemption
  const tokens = await authRepository.getAuthCode(sanitizedAuthCode);
  if (!tokens) {
    throw new NotFoundError('Auth code not found');
  }
  const { access_token, refresh_token } = JSON.parse(tokens);
  return { access_token, refresh_token };
};

const getLoginHistory = async (user_id: string) => {
  return await authRepository.getLoginHistory(user_id);
};

const authServices = {
  googleAuthWithCode,
  refreshAccessToken,
  logoutUser,
  generateErrorCode,
  getDataFromErrorCode,
  generateAuthCode,
  getDataFromAuthCode,
  getLoginHistory,
};

export default authServices;
