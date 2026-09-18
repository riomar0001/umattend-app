import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository';
import { Prisma } from '@/generated/prisma/client';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/customErrors';
import {
  FetchUserAttendedEvents,
  FetchUserAttendedEventsDetailed,
  FetchUserHostedEvents,
  FetchUserInfoResult,
  OnboardedUserInfoResult,
} from '../interface/auth';
import { generateAccessToken } from '../services/jwt.service';
import {
  isAcceptableStudentId,
  isUsableStudentId,
  STUDENT_ID_RULE_MESSAGE,
} from '../../utils/studentId';
import {
  JWT_ATTENDANCE_TOKEN_SECRET,
  JWT_ATTENDANCE_TOKEN_TTL,
} from '../../constants/jwt.constants';

const getUserById = async (user_id: string): Promise<FetchUserInfoResult> => {
  const user = await userRepository.findUserById(user_id);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    umindanao_email: user.umindanao_email,
    name: user.student?.name ?? undefined,
    department: user.student?.department ?? undefined,
    program: user.student?.program ?? undefined,
    profile_picture: user.student?.profile_picture ?? undefined,
    done_onboarding: user.done_onboarding,
    role: user.role,
  };
};

const onboardUser = async (
  user_id: string,
  department: string,
  program: string,
  student_id?: number | null
): Promise<OnboardedUserInfoResult | null> => {
  const existing = await userRepository.findUserById(user_id);
  if (!existing?.student) {
    throw new NotFoundError('User not found');
  }

  // An ID parsed out of the email address is authoritative. Onboarding only
  // fills the gap left by addresses that carry no number, so a submitted value
  // is ignored whenever one is already on file — that is what stops the form
  // from being used to overwrite an ID, or to claim someone else's.
  let id_to_write: number | undefined;

  if (!isUsableStudentId(existing.student.student_id)) {
    if (student_id === undefined || student_id === null) {
      throw new BadRequestError('ID number is required');
    }

    if (!isAcceptableStudentId(student_id)) {
      throw new ValidationError(STUDENT_ID_RULE_MESSAGE);
    }

    id_to_write = student_id;
  }

  let user: Awaited<ReturnType<typeof userRepository.onboardUser>>;

  try {
    user = await userRepository.onboardUser(
      user_id,
      department,
      program,
      id_to_write
    );
  } catch (error) {
    // students.student_id is unique, so the number is either free or already
    // spoken for. Reported as a conflict on the field the user just typed
    // rather than as a generic failure they cannot act on.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.meta?.target ?? '').includes('student_id')
    ) {
      throw new ConflictError(
        'That ID number is already registered to another account'
      );
    }

    throw error;
  }

  if (!user) {
    throw new NotFoundError('User not found');
  }

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
    // Carried here as it is in the other two mint sites. Without it the client
    // decodes a token with no picture and blanks the avatar for as long as it
    // takes the follow-up /user fetch to land.
    profile_picture: user.student?.profile_picture ?? '',
  });

  return {
    access_token,
    user,
  };
};

const getUserAttendedEvents = async (
  user_id: string
): Promise<FetchUserAttendedEvents[] | null> => {
  const student = await userRepository.findUserById(user_id);
  if (!student || !student.student) {
    return null;
  }

  // Attendance is keyed by student_id, so an account without one cannot have
  // attended anything — an empty history, not an error.
  if (student.student.student_id === null) {
    return [];
  }

  const events = await userRepository.getUserAttendedEvents(
    student.student.student_id
  );
  if (!events) {
    return null;
  }

  return events;
};

const getUserAttendedEventsDetailed = async (
  user_id: string
): Promise<FetchUserAttendedEventsDetailed[]> => {
  const student = await userRepository.findUserById(user_id);
  if (!student || !student.student) {
    throw new NotFoundError('User not found');
  }

  if (student.student.student_id === null) {
    return [];
  }

  const events = await userRepository.getUserAttendedEventsDetailed(
    student.student.student_id
  );
  return events;
};

const getUserHostedEvents = async (
  user_id: string
): Promise<FetchUserHostedEvents[]> => {
  const events = await userRepository.getUserHostedEvents(user_id);
  return events;
};

const updateUserProfile = async (
  user_id: string,
  department?: string,
  program?: string,
  // Correcting an ID number is allowed here, unlike at onboarding, where a
  // submitted value is ignored once one is on file. The accounts that most
  // need it are the ones that were given a wrong or placeholder ID by an
  // earlier build and have no other way to put it right.
  student_id?: number
) => {
  if (student_id !== undefined && !isAcceptableStudentId(student_id)) {
    throw new ValidationError(STUDENT_ID_RULE_MESSAGE);
  }

  let user: Awaited<ReturnType<typeof userRepository.updateUserProfile>>;

  try {
    user = await userRepository.updateUserProfile(
      user_id,
      department,
      program,
      student_id
    );
  } catch (error) {
    // The number is either free or already spoken for. Reported against the
    // field the user just typed rather than as a generic failure.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      String(error.meta?.target ?? '').includes('student_id')
    ) {
      throw new ConflictError(
        'That ID number is already registered to another account'
      );
    }

    throw error;
  }

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const stored_student_id = user.student?.student_id;

  // The client reads student_id off the access token, so changing it without
  // reissuing would leave the profile showing the old number until the token
  // happened to expire.
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

  return {
    access_token,
    user: {
      id: user.id,
      umindanao_email: user.umindanao_email,
      name: user.student?.name ?? undefined,
      student_id: isUsableStudentId(stored_student_id)
        ? stored_student_id
        : null,
      department: user.student?.department ?? undefined,
      program: user.student?.program ?? undefined,
      profile_picture: user.student?.profile_picture ?? undefined,
      done_onboarding: user.done_onboarding,
      role: user.role,
    },
  };
};

export interface AttendanceToken {
  token: string;
  /**
   * Lifetime in seconds, so the client can schedule its refresh from the real
   * value instead of assuming one.
   *
   * The QR display used to refetch on a hardcoded 59-minute timer, which only
   * worked because production happened to set a 3600s TTL. Staging sets 300s,
   * so the displayed code was expired for 54 of every 59 minutes and every scan
   * of it failed with "This QR code has expired". Reporting the TTL removes the
   * coupling: changing JWT_ATTENDANCE_TOKEN_TTL no longer silently breaks the
   * frontend.
   */
  expires_in: number;
}

const getAttendanceToken = async (
  user_id: string
): Promise<AttendanceToken> => {
  const user = await userRepository.findUserById(user_id);

  if (!user?.student) {
    throw new NotFoundError('Student profile not found');
  }

  // Split out from the profile check because the two are fixed differently:
  // a missing ID number is the account's own to supply, and the old combined
  // `!student_id` guard reported it as a missing profile.
  if (!isUsableStudentId(user.student.student_id)) {
    throw new BadRequestError(
      'No ID number on file for this account. Add your ID number in your profile to generate an attendance QR code.'
    );
  }

  // Guard the parse: an unset or malformed TTL would reach jwt.sign as NaN,
  // which it rejects — turning a config typo into a 500 on every QR load.
  const parsed = Number(JWT_ATTENDANCE_TOKEN_TTL);
  const expires_in = Number.isFinite(parsed) && parsed > 0 ? parsed : 300;

  const token = jwt.sign(
    { student_id: user.student.student_id },
    JWT_ATTENDANCE_TOKEN_SECRET,
    { expiresIn: expires_in } as jwt.SignOptions
  );

  return { token, expires_in };
};

const userService = {
  getUserById,
  onboardUser,
  getUserAttendedEvents,
  getUserAttendedEventsDetailed,
  getUserHostedEvents,
  updateUserProfile,
  getAttendanceToken,
};

export default userService;
