import { Request, Response } from 'express';
import userService from '../services/user.service';
import {
  HTTPErrorResponse,
  HTTPSuccessResponse,
} from '@/utils/responseHandler';
import { NotFoundError } from '../../utils/customErrors';

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
    const { department, program } = req.body;
    if (!department || !program) {
      return HTTPErrorResponse(res, 400, 'Missing Fields');
    }
    const onboarded = await userService.onboardUser(
      user_id,
      department,
      program
    );

    if (!onboarded) {
      return HTTPErrorResponse(res, 404, 'User not found') as Response;
    }

    res.cookie('access_token', onboarded.access_token, {
      httpOnly: true,
      secure: NODE_ENV === 'PRODUCTION',
      sameSite: 'strict',
      maxAge: 1 * 60 * 60 * 1000,
    });

    return HTTPSuccessResponse(
      res,
      200,
      'User succesfully updated',
      onboarded
    ) as Response;
  } catch (error: unknown) {
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

    if (events?.length === 0) {
      return HTTPSuccessResponse(
        res,
        200,
        'User has not attended any events yet',
        []
      );
    }

    return HTTPSuccessResponse(
      res,
      200,
      'Attended events successfully fetched',
      {
        events,
      }
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

    if (events?.length === 0) {
      return HTTPSuccessResponse(
        res,
        200,
        'User has not created any events yet',
        []
      );
    }

    return HTTPSuccessResponse(res, 200, 'Hosted events successfully fetched', {
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

const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const user_id = req.user.id;
    const { department, program } = req.body;

    if (department === undefined && program === undefined) {
      return HTTPErrorResponse(res, 400, 'No fields to update');
    }

    const updated = await userService.updateUserProfile(
      user_id,
      department,
      program
    );

    return HTTPSuccessResponse(res, 200, 'User profile updated', {
      user: updated,
    });
  } catch (error: unknown) {
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
    const token = await userService.getAttendanceToken(req.user.id);
    return HTTPSuccessResponse(res, 200, 'Attendance token generated', { token });
  } catch (error: unknown) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
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
