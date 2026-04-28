import { Request, Response } from 'express';
import adminService from '../services/admin.service';
import {
  HTTPErrorResponse,
  HTTPSuccessResponse,
} from '@/utils/responseHandler';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '@/utils/customErrors';
import { matchedData, validationResult } from 'express-validator';
import eventRepository from '../repositories/event.repository';
import { NODE_ENV } from '@/constants/app.constants';

// ---------------------------------------------------------------------------
// Dead Letter Queue
// ---------------------------------------------------------------------------

const getQueues = async (_req: Request, res: Response) => {
  try {
    const queues = await adminService.getAllQueues();
    return HTTPSuccessResponse(res, 200, 'Queues retrieved', queues);
  } catch (error) {
    if (NODE_ENV === 'DEVELOPMENT') console.error('getQueues error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const getFailedJobs = async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await adminService.getFailedJobs(queueName, page, limit);
    return HTTPSuccessResponse(res, 200, 'Failed jobs retrieved', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('getFailedJobs error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const retryFailedJob = async (req: Request, res: Response) => {
  try {
    const { queueName, jobId } = req.params;
    const result = await adminService.retryJob(queueName, jobId);
    return HTTPSuccessResponse(res, 200, 'Job retried', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('retryFailedJob error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const deleteFailedJob = async (req: Request, res: Response) => {
  try {
    const { queueName, jobId } = req.params;
    const result = await adminService.removeJob(queueName, jobId);
    return HTTPSuccessResponse(res, 200, 'Job removed', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('deleteFailedJob error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const retryAllFailedJobs = async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const result = await adminService.retryAllFailed(queueName);
    return HTTPSuccessResponse(res, 200, 'All failed jobs retried', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('retryAllFailedJobs error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const cleanAllFailedJobs = async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const result = await adminService.cleanAllFailed(queueName);
    return HTTPSuccessResponse(res, 200, 'Failed jobs cleaned', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('cleanAllFailedJobs error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await adminService.getAllUsers(page, limit, search);
    return HTTPSuccessResponse(res, 200, 'Users retrieved', result);
  } catch (error) {
    if (NODE_ENV === 'DEVELOPMENT') console.error('getAllUsers error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const getUserById = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await adminService.getUserById(userId);
    return HTTPSuccessResponse(res, 200, 'User retrieved', { user });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('getUserById error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const updateUserRole = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const { userId } = req.params;
    const { role } = matchedData(req);

    const updated = await adminService.updateUserRole(userId, role);
    return HTTPSuccessResponse(res, 200, 'User role updated', { user: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('updateUserRole error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await adminService.softDeleteUser(userId);
    return HTTPSuccessResponse(res, 200, 'User soft-deleted', result);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (error instanceof ConflictError) {
      return HTTPErrorResponse(res, 409, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('deleteUser error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const getAllEvents = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string | undefined;

    const result = await adminService.getAllEvents(page, limit, search);
    return HTTPSuccessResponse(res, 200, 'Events retrieved', result);
  } catch (error) {
    if (NODE_ENV === 'DEVELOPMENT') console.error('getAllEvents error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const updateEvent = async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return HTTPErrorResponse(res, 400, errors.array());
    }

    const data = matchedData(req);
    const { eventId } = req.params;

    if (!eventId) {
      return HTTPErrorResponse(res, 400, 'Event ID is required');
    }

    const {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
    } = data as any;

    const existing = await eventRepository.getEventDetails(eventId);
    if (!existing) {
      return HTTPErrorResponse(res, 404, 'Event not found');
    }

    const updatedEventData = {
      title,
      description,
      department,
      location,
      capacity,
      all_day,
      start_time,
      end_time,
      check_out_required,
      is_done,
      created_by: existing.created_by,
    };

    const updated = await adminService.updateEvent(eventId, updatedEventData);
    return HTTPSuccessResponse(res, 200, 'Event updated', updated);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return HTTPErrorResponse(res, 404, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('updateEvent error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

const getRateLimits = async (req: Request, res: Response) => {
  try {
    const limits = await adminService.getRateLimits();
    return HTTPSuccessResponse(res, 200, 'Rate limits retrieved', { entries: limits });
  } catch (error) {
    if (NODE_ENV === 'DEVELOPMENT') console.error('getRateLimits error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const deleteRateLimit = async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    await adminService.deleteRateLimit(key);
    return HTTPSuccessResponse(res, 200, 'Rate limit cleared', { key });
  } catch (error) {
    if (error instanceof BadRequestError) {
      return HTTPErrorResponse(res, 400, error.message);
    }
    if (NODE_ENV === 'DEVELOPMENT') console.error('deleteRateLimit error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const deleteAllRateLimits = async (_req: Request, res: Response) => {
  try {
    const removed = await adminService.deleteAllRateLimits();
    return HTTPSuccessResponse(res, 200, 'All rate limits cleared', { removed });
  } catch (error) {
    if (NODE_ENV === 'DEVELOPMENT') console.error('deleteAllRateLimits error:', error);
    return HTTPErrorResponse(res, 500, 'Internal server error');
  }
};

const adminController = {
  getQueues,
  getFailedJobs,
  retryFailedJob,
  deleteFailedJob,
  retryAllFailedJobs,
  cleanAllFailedJobs,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getAllEvents,
  updateEvent,
  getRateLimits,
  deleteRateLimit,
  deleteAllRateLimits,
};

export default adminController;
