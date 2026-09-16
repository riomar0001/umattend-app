import GoogleAuth from '../services/google.service.js';
import authRepository from '../repositories/auth.repository.js';
import jwt from 'jsonwebtoken';
import { Prisma } from '@/generated/prisma/client';
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
import { isUsableStudentId } from '@/utils/studentId.js';

const googleAuthWithCode = async (
  code: string,
  state: string,
  ip_address: string,
  userAgent: string
) => {
  const googleUser = await GoogleAuth.exchangeCodeForUserInfo(code, state);

  let user = await authRepository.findUserByGoogleId(googleUser.google_id);

  if (!user) {
    // null when the address carries no ID number (`tan.jessiejames@…`). Stored
    // as-is rather than coerced — onboarding asks for the number instead.
    const student_id = extractStudentID(googleUser.email);
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // A concurrent OAuth callback created the user first — fetch the
        // existing row. A null result means the conflict was on some other
        // unique column, so the re-fetch cannot resolve it.
        user = await authRepository.findUserByGoogleId(googleUser.google_id);

        if (!user) {
          // student_id is the one that can collide on data rather than on a
          // race: two accounts whose addresses carry the same ID number. The
          // bare P2002 gives the user a generic failure and leaves no trace of
          // which account is already holding the number.
          const target = String(error.meta?.target ?? '');

          if (target.includes('student_id')) {
            throw new AuthenticationError(
              `The ID number in ${googleUser.email} is already registered to another account`
            );
          }

          throw error;
        }
      } else {
        throw error;
      }
    }
  }

  // A user row can exist with no student row attached to it. createUser writes
  // the pair as a single nested create, but D1 has no interactive transactions,
  // so when the student insert failed — every address the old code could not
  // parse an ID out of collided on the unique `student_id = 0` — Prisma had no
  // way to undo the user row it had already written. The P2002 branch above
  // then found that half-written account and handed it straight back.
  //
  // Such an account logs in and looks signed-out-of-itself: the token carries
  // no name, no picture and no ID, the profile reads "User", and onboarding
  // rejects it with "User not found" because it has no student row to update.
  // Nothing else in the app can create one, and only Google knows the name, so
  // this is the one place the damage can be repaired — on the next login.
  if (!user.student) {
    try {
      await authRepository.createStudentForUser(user.id, {
        name: googleUser.name,
        student_id: extractStudentID(googleUser.email),
        profile_picture: googleUser.profile_picture,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = String(error.meta?.target ?? '');

        // The same collision that broke the row in the first place: the ID
        // number in this address belongs to a student row already. Named, so
        // it can be resolved, rather than reported as a repair that failed.
        if (target.includes('student_id')) {
          throw new AuthenticationError(
            `The ID number in ${googleUser.email} is already registered to another account`
          );
        }

        // student.user_id is unique, so this is a concurrent login for the
        // same account repairing it first — the outcome we wanted anyway.
      } else {
        throw error;
      }
    }

    // Re-read rather than patching the object by hand, so the token below is
    // minted from what the database actually holds.
    user = await authRepository.findUserByGoogleId(googleUser.google_id);

    if (!user?.student) {
      throw new AuthenticationError(
        'Your account is missing its student profile and could not be repaired. Please contact support.'
      );
    }
  }

  await authRepository.updateLoginAndProfile(
    user.id,
    googleUser.profile_picture
  );

  // Normalised at the token boundary so the client sees one representation of
  // "no ID". Rows written before the column was nullable hold 0, and so does
  // anything a worker still running that code creates — null is the only form
  // the client checks for.
  const stored_student_id = user.student?.student_id;

  const access_token = generateAccessToken({
    user_id: user.id,
    umindanao_email: user.umindanao_email,
    role: user.role,
    done_onboarding: user.done_onboarding,
    student_id: isUsableStudentId(stored_student_id) ? stored_student_id : null,
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

  // Refreshing cannot repair a half-written account — only the Google callback
  // has the name to rebuild the student row with. Answer 401 so the client
  // clears the session and sends them back through login, which does repair it;
  // minting a nameless token here would just prolong the broken state.
  if (!user.student) {
    throw new AuthenticationError(
      'Account profile is incomplete — please sign in again'
    );
  }

  const stored_student_id = user.student.student_id;

  return generateAccessToken({
    user_id: user.id,
    umindanao_email: user.umindanao_email,
    role: user.role,
    done_onboarding: user.done_onboarding,
    student_id: isUsableStudentId(stored_student_id) ? stored_student_id : null,
    name: user.student.name,
    department: user.student.department ?? '',
    program: user.student.program ?? '',
    profile_picture: user.student.profile_picture ?? '',
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
