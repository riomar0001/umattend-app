import { Request, Response } from 'express';
import userService from '../services/user.service';
import {
  HTTPErrorResponse,
  HTTPSuccessResponse,
} from '@/utils/responseHandler';
import {
  AppError,
  BadRequestError,
  NotFoundError,
} from '../../utils/customErrors';
import { accessTokenCookie } from '@/utils/authCookies';

import { NODE_ENV } from '@/constants/app.constants';

const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    const user = await userService.getUserById(id);

    if (!user) {
      return HTTPErrorResponse(res, 404, 'User not found') as Response;
    }

    return HTTPSuccessResponse(res, 200, 'User succesfully fetched', {
      user,
    }) as Response;
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const onboardUser = async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id;
    const { department, program, student_id } = req.body;
    if (!department || !program) {
      return HTTPErrorResponse(res, 400, 'Missing Fields');
    }

    // Optional in the body: only accounts whose email carried no ID number are
    // asked for one, and the service decides whether it is actually required.
    // Number('') is 0 and Number(undefined) is NaN, so absence is normalised to
    // null here rather than handed to the service as a misleading number.
    const parsed_student_id =
      student_id === undefined || student_id === null || student_id === ''
        ? null
        : Number(student_id);

    const onboarded = await userService.onboardUser(
      user_id,
      department,
      program,
      parsed_student_id
    );

    if (!onboarded) {
      return HTTPErrorResponse(res, 404, 'User not found') as Response;
    }

    res.cookie('access_token', onboarded.access_token, accessTokenCookie());

    return HTTPSuccessResponse(
      res,
      200,
      'User succesfully updated',
      onboarded
    ) as Response;
  } catch (error: unknown) {
    // AppError carries its own status. The previous `instanceof Error` branch
    // caught those first and answered 500, so a rejected ID number came back
    // indistinguishable from a server fault — the client had nothing to tell
    // the user to fix.
    if (error instanceof AppError) {
      return HTTPErrorResponse(res, error.statusCode, error.message);
    }
    if (error instanceof Error) {
      return HTTPErrorResponse(res, 500, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getUserAttendedEvents = async (req: Request, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    const events = await userService.getUserAttendedEvents(id);

    if (events === null) {
      return HTTPSuccessResponse(
        res,
        200,
        'User does not attend events yet',
        null
      );
    }

    if (!events) {
      return HTTPErrorResponse(res, 404, 'events not found') as Response;
    }

    return HTTPSuccessResponse(res, 200, 'events succesfully fetched', {
      events,
    }) as Response;
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getUserAttendedEventsDetailed = async (req: Request, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    const events = await userService.getUserAttendedEventsDetailed(id);

    return HTTPSuccessResponse(
      res,
      200,
      events?.length === 0 ? 'User has not attended any events yet' : 'Attended events successfully fetched',
      { events: events ?? [] }
    ) as Response;
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getUserHostedEvents = async (req: Request, res: Response) => {
  try {
    const { id } = req.user as { id: string };
    const events = await userService.getUserHostedEvents(id);

    return HTTPSuccessResponse(
      res,
      200,
      events?.length === 0 ? 'User has not created any events yet' : 'Hosted events successfully fetched',
      { events: events ?? [] }
    ) as Response;
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message) as Response;
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id;
    const { department, program, student_id } = req.body;

    if (
      department === undefined &&
      program === undefined &&
      student_id === undefined
    ) {
      return HTTPErrorResponse(res, 400, 'No fields to update');
    }

    // Number('') is 0 and Number(undefined) is NaN, so absence is normalised to
    // undefined — the value that leaves the stored ID untouched — rather than
    // handed to the service as a number it would then reject.
    const parsed_student_id =
      student_id === undefined || student_id === null || student_id === ''
        ? undefined
        : Number(student_id);

    const updated = await userService.updateUserProfile(
      user_id,
      department,
      program,
      parsed_student_id
    );

    return HTTPSuccessResponse(res, 200, 'User profile updated', updated);
  } catch (error: unknown) {
    // AppError carries its own status, so a rejected or duplicate ID number
    // comes back as 400/409 with a message the user can act on rather than as
    // an indistinguishable 500.
    if (error instanceof AppError) {
      return HTTPErrorResponse(res, error.statusCode, error.message);
    }

    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }

    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const getAttendanceToken = async (req: Request, res: Response) => {
  try {
    const { token, expires_in } = await userService.getAttendanceToken(
      req.user.id
    );
    // `expires_in` is what lets the QR view refresh before the code dies,
    // rather than on a hardcoded interval that has to be kept in step with
    // JWT_ATTENDANCE_TOKEN_TTL by hand. See user.service.
    return HTTPSuccessResponse(res, 200, 'Attendance token generated', {
      token,
      expires_in,
    });
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    // "No ID number on file for this account…" is the account's own to fix and
    // the message says how. Without this branch it fell through to the 500
    // below and was reported as a server fault, so the one person who could
    // resolve it was told to try again later instead.
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') {
      return HTTPErrorResponse(res, 500, error);
    }
    return HTTPErrorResponse(res, 500, 'Internal server error') as Response;
  }
};

const userController = {
  getUserById,
  onboardUser,
  getUserAttendedEvents,
  getUserAttendedEventsDetailed,
  getUserHostedEvents,
  updateUserProfile,
  getAttendanceToken,
};

export default userController;
