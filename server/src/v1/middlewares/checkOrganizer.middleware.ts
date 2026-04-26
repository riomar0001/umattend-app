import { Request, Response, NextFunction } from 'express';
import eventRepository from '../repositories/event.repository';
import { HTTPErrorResponse } from '@/utils/responseHandler';

export const checkOrganizer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user_id = req.user.id;
    const event_id = req.params.event_id;

    if (!user_id || !event_id) {
      return HTTPErrorResponse(res, 400, 'User ID and Event ID are required.');
    }

    if (req.user.role === 'admin' || req.user.role === 'csg') {
      return next();
    }

    const organizer = await eventRepository.checkOrganizer(user_id, event_id);

    if (!organizer) {
      return HTTPErrorResponse(
        res,
        403,
        'User is not an organizer for this event.'
      );
    }

    return next();
  } catch (error: unknown) {
    console.error('Organizer check failed:', error);
    HTTPErrorResponse(res, 500, 'Failed to verify organizer status.');
  }
};
