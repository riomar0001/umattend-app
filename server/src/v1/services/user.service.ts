import jwt from 'jsonwebtoken';
import userRepository from '../repositories/user.repository';
import { NotFoundError } from '../../utils/customErrors';
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
    student_id: Number(user.student?.student_id),
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
  if (!user?.student?.student_id) {
    throw new NotFoundError('Student profile not found');
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
