import { Request, Response, NextFunction } from 'express';
import eventRepository from '../repositories/event.repository';
import redis from '../../configs/redis.config';
import { HTTPErrorResponse } from '@/utils/responseHandler';

const ORGANIZER_CACHE_TTL_SECONDS = 60;

const cacheKey = (user_id: string, event_id: string) =>
  `organizer:${event_id}:${user_id}`;

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

    // Short-TTL cache: organizer membership rarely changes mid-event but we
    // keep TTL short so add/remove organizer takes effect quickly enough.
    const key = cacheKey(user_id, event_id);
    let isOrganizer: boolean | null = null;
    try {
      const cached = await redis.get(key);
      if (cached === '1') {
        isOrganizer = true;
      } else if (cached === '0') {
        isOrganizer = false;
      }
    } catch {
      // Redis miss/error: fall through to DB lookup. Don't fail the request.
    }

    if (isOrganizer === null) {
      const organizer = await eventRepository.checkOrganizer(user_id, event_id);
      isOrganizer = !!organizer;
      try {
        await redis.set(
          key,
          isOrganizer ? '1' : '0',
          'EX',
          ORGANIZER_CACHE_TTL_SECONDS
        );
      } catch {
        // best-effort cache write
      }
    }

    if (!isOrganizer) {
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

// Invalidate the cache when an organizer is added or removed so the change
// takes effect immediately rather than waiting for the TTL.
export const invalidateOrganizerCache = async (
  user_id: string,
  event_id: string
): Promise<void> => {
  try {
    await redis.del(cacheKey(user_id, event_id));
  } catch {
    // best-effort
  }
};
