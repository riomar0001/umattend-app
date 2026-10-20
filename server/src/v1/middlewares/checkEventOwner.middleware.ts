import { Request, Response, NextFunction } from 'express';
import eventRepository from '../repositories/event.repository';
import { HTTPErrorResponse } from '@/utils/responseHandler';
import { routeParam } from '@/utils/routeParams';

export const checkEventOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const eventId = routeParam(req, 'event_id') || routeParam(req, 'eventId');
  if (!eventId) {
    return HTTPErrorResponse(res, 400, 'Event ID is required');
  }
  try {
    const event = await eventRepository.getEventDetails(eventId);
    if (!event) {
      return HTTPErrorResponse(res, 404, 'Event not found');
    }
    if (req.user.role !== 'admin' && event.created_by !== req.user.id) {
      return HTTPErrorResponse(
        res,
        403,
        'Only the event creator or an admin can perform this action'
      );
    }
    next();
    return;
  } catch {
    return HTTPErrorResponse(res, 500, 'Failed to verify event ownership');
  }
};
