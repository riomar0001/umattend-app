import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository';
import { BadRequestError, NotFoundError } from '../../utils/customErrors';
import {
  FetchUserAttendedEvents,
  FetchUserAttendedEventsDetailed,
  FetchUserHostedEvents,
  FetchUserInfoResult,
  OnboardedUserInfoResult,
} from '../interface/auth';
import { generateAccessToken } from '../services/jwt.service';
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
  program: string
): Promise<OnboardedUserInfoResult | null> => {
  const user = await userRepository.onboardUser(user_id, department, program);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const access_token = generateAccessToken({
    user_id: user.id,
    umindanao_email: user.umindanao_email,
    role: user.role,
    done_onboarding: user.done_onboarding,
    student_id: user.student?.student_id ?? null,
    name: user.student?.name,
    department: user.student?.department ?? '',
    program: user.student?.program ?? '',
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
  program?: string
) => {
  const user = await userRepository.updateUserProfile(
    user_id,
    department,
    program
  );
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

const getAttendanceToken = async (user_id: string): Promise<string> => {
  const user = await userRepository.findUserById(user_id);

  if (!user?.student) {
    throw new NotFoundError('Student profile not found');
  }

  // Split out from the profile check because the two are fixed differently:
  // a missing ID number is the account's own to supply, and the old combined
  // `!student_id` guard reported it as a missing profile. It also swallowed
  // the legitimate-looking 0 that unparsed addresses used to be stored with.
  if (user.student.student_id === null) {
    throw new BadRequestError(
      'No ID number on file for this account. Add your ID number in your profile to generate an attendance QR code.'
    );
  }

  return jwt.sign(
    { student_id: user.student.student_id },
    JWT_ATTENDANCE_TOKEN_SECRET,
    { expiresIn: Number(JWT_ATTENDANCE_TOKEN_TTL) } as jwt.SignOptions
  );
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
