import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../utils/customErrors';
import rateLimitStore from '../../configs/rateLimit.config';
import adminRepository from '../repositories/admin.repository';
import eventRepository from '../repositories/event.repository';
import { WINDOW_MS } from '../middlewares/rateLimiter.middleware';

const VALID_ROLES = ['student', 'admin', 'csg', 'instructor', 'organizer'];

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------
//
// BullMQ kept every job in Redis, so the admin panel could count them, page
// through failures, and retry or delete an individual job by id.
//
// Cloudflare Queues exposes none of that. A queue is write-and-forget: there is
// no API to enumerate messages, read backlog contents, or address a single
// message. Retries and dead-lettering happen inside the platform, driven by the
// `max_retries` / `dead_letter_queue` settings in wrangler.jsonc, and the
// dead-letter queue can only be *consumed* — never browsed.
//
// Rather than return invented numbers, these report that the capability is
// gone and the mutating operations refuse outright. Restoring the panel means
// recording job outcomes ourselves (a `failed_job` table in D1 written by the
// consumers in src/worker/consumers/), which is a feature build, not a port.

const QUEUE_NAMES = [
  'umattend-email',
  'umattend-event-status',
  'umattend-dlq',
] as const;

const UNSUPPORTED =
  'Per-job inspection is not available on Cloudflare Queues. Retries and ' +
  'dead-lettering are handled by the platform; see the dead-letter queue and ' +
  'Workers logs instead.';

const getAllQueues = async () => {
  return QUEUE_NAMES.map((name) => ({
    name,
    counts: {},
    supported: false,
    note: UNSUPPORTED,
  }));
};

const getFailedJobs = async (
  queueName: string,
  page: number,
  limit: number
) => {
  void queueName;
  return {
    data: [],
    supported: false,
    note: UNSUPPORTED,
    pagination: { page, limit, total: 0, totalPages: 0 },
  };
};

const retryJob = async (queueName: string, jobId: string) => {
  void queueName;
  void jobId;
  throw new BadRequestError(UNSUPPORTED);
};

const removeJob = async (queueName: string, jobId: string) => {
  void queueName;
  void jobId;
  throw new BadRequestError(UNSUPPORTED);
};

const retryAllFailed = async (queueName: string) => {
  void queueName;
  throw new BadRequestError(UNSUPPORTED);
};

const cleanAllFailed = async (queueName: string) => {
  void queueName;
  throw new BadRequestError(UNSUPPORTED);
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const getAllUsers = async (page: number, limit: number, search?: string) => {
  const { users, total } = await adminRepository.findAllUsers(
    page,
    limit,
    search
  );
  return {
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getUserById = async (userId: string) => {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
};

const updateUserRole = async (userId: string, role: string) => {
  if (!VALID_ROLES.includes(role)) {
    throw new BadRequestError(
      `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
    );
  }

  const existing = await adminRepository.findUserById(userId);
  if (!existing) {
    throw new NotFoundError('User not found');
  }

  return await adminRepository.updateUserRole(userId, role);
};

const softDeleteUser = async (userId: string) => {
  const existing = await adminRepository.findUserById(userId);
  if (!existing) {
    throw new NotFoundError('User not found');
  }
  if (existing.deleted_at) {
    throw new ConflictError('User is already deleted');
  }
  await adminRepository.softDeleteUser(userId);
  return { userId, deleted: true };
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const getAllEvents = async (page: number, limit: number, search?: string) => {
  const { data, total } = await adminRepository.findAllEvents(
    page,
    limit,
    search,
    true
  );
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const updateEvent = async (
  eventId: string,
  eventData: Record<string, unknown>
) => {
  const existing = await eventRepository.getEventDetails(eventId);
  if (!existing) {
    throw new NotFoundError('Event not found');
  }

  // Admin override — bypasses the created_by check in eventService.updateEvent
  return await eventRepository.updateEvent(
    eventId,
    eventData as unknown as Parameters<typeof eventRepository.updateEvent>[1]
  );
};

// ---------------------------------------------------------------------------
// Rate Limits
// ---------------------------------------------------------------------------

interface RateLimitEntry {
  key: string;
  count: number;
  ttl: number;
}

const RATE_LIMIT_PREFIX = 'rateLimit:';

// The Lua script and SCAN loop are gone: all rate-limit state lives in one
// Durable Object, which can list its own storage by prefix and prune expired
// hits atomically. See src/worker/rateLimiter.do.ts.
const getRateLimits = async (): Promise<RateLimitEntry[]> => {
  return rateLimitStore.list(RATE_LIMIT_PREFIX, WINDOW_MS);
};

const deleteRateLimit = async (key: string): Promise<void> => {
  // Only allow deleting rate limit keys for safety
  if (!key.startsWith(RATE_LIMIT_PREFIX)) {
    throw new BadRequestError('Invalid rate limit key');
  }
  await rateLimitStore.delete(key);
};

const deleteAllRateLimits = async (): Promise<number> => {
  return rateLimitStore.deleteAll(RATE_LIMIT_PREFIX);
};


const adminService = {
  getAllQueues,
  getFailedJobs,
  retryJob,
  removeJob,
  retryAllFailed,
  cleanAllFailed,
  getAllUsers,
  getUserById,
  updateUserRole,
  softDeleteUser,
  getAllEvents,
  updateEvent,
  getRateLimits,
  deleteRateLimit,
  deleteAllRateLimits,
};

export default adminService;
