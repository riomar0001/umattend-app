import { Queue, Job } from 'bullmq';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../utils/customErrors';
import { emailQueue } from '../queues/email.queue';
import { startEventStatusQueue } from '../queues/startEvent.queue';
import { endEventStatusQueue } from '../queues/endEvent.queue';
import redis from '../../configs/redis.config';
import adminRepository from '../repositories/admin.repository';
import eventRepository from '../repositories/event.repository';
import { WINDOW_MS } from '../middlewares/rateLimiter.middleware';

const VALID_ROLES = ['student', 'admin', 'csg', 'instructor', 'organizer'];

const QUEUE_MAP: Record<string, Queue> = {
  'email-queue': emailQueue,
  'event-start-status-queue': startEventStatusQueue,
  'event-end-status-queue': endEventStatusQueue,
};

function resolveQueue(name: string): Queue {
  const q = QUEUE_MAP[name];
  if (!q) {
    throw new NotFoundError(`Queue "${name}" not found`);
  }
  return q;
}

// ---------------------------------------------------------------------------
// Dead Letter Queue
// ---------------------------------------------------------------------------

const getAllQueues = async () => {
  const results = await Promise.allSettled(
    Object.entries(QUEUE_MAP).map(async ([name, queue]) => {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed'
      );
      return { name, counts };
    })
  );

  return results.map((r) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: 'unknown', counts: {}, error: String(r.reason) }
  );
};

const getFailedJobs = async (
  queueName: string,
  page: number,
  limit: number
) => {
  const queue = resolveQueue(queueName);
  const start = (page - 1) * limit;
  const end = start + limit - 1;

  const [jobs, total] = await Promise.all([
    queue.getJobs(['failed'], start, end, false),
    queue.getJobCounts('failed'),
  ]);

  const failedCount = total?.failed ?? 0;
  const data = jobs.map((job: Job) => ({
    id: job.id,
    name: job.name,
    data: job.data,
    failedReason: job.failedReason,
    stacktrace: job.stacktrace ?? [],
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  }));

  return {
    data,
    pagination: {
      page,
      limit,
      total: failedCount,
      totalPages: Math.ceil(failedCount / limit),
    },
  };
};

const retryJob = async (queueName: string, jobId: string) => {
  const queue = resolveQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) {
    throw new NotFoundError(`Job "${jobId}" not found`);
  }
  await job.retry();
  return { jobId, retried: true };
};

const removeJob = async (queueName: string, jobId: string) => {
  const queue = resolveQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) {
    throw new NotFoundError(`Job "${jobId}" not found`);
  }
  await job.remove();
  return { jobId, removed: true };
};

const retryAllFailed = async (queueName: string) => {
  const queue = resolveQueue(queueName);
  const jobs = await queue.getJobs(['failed']);
  const results = await Promise.allSettled(jobs.map((j) => j.retry()));
  const retried = results.filter((r) => r.status === 'fulfilled').length;
  return { retried };
};

const cleanAllFailed = async (queueName: string) => {
  const queue = resolveQueue(queueName);
  const BATCH = 1000;
  let removed = 0;

  // clean() removes up to `limit` jobs older than `grace` ms. Loop to remove all.

  while (true) {
    const batchRemoved = await queue.clean(0, BATCH, 'failed');
    removed += batchRemoved.length;
    if (batchRemoved.length < BATCH) {
      break;
    }
  }

  return { removed };
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

const adminCountScript = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)

if count == 0 then
  redis.call('DEL', key)
  return {0, -2}
end

local ttl = redis.call('PTTL', key)
return {count, ttl}
`;

const getRateLimits = async (): Promise<RateLimitEntry[]> => {
  const keys: string[] = [];

  // Use SCAN for production safety — avoids blocking Redis on large key spaces
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(
      cursor,
      'MATCH',
      `${RATE_LIMIT_PREFIX}*`,
      'COUNT',
      100
    );
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) {
    return [];
  }

  // Run cleanup+count for each key in parallel. Each EVAL atomically evicts
  // expired entries before counting, so the admin page shows per-request
  // decrements instead of the whole key vanishing at once.
  const results = await Promise.all(
    keys.map((k) =>
      redis
        .eval(adminCountScript, 1, k, String(Date.now()), String(WINDOW_MS))
        .then((result) => {
          const [count, ttl] = result as [number, number];
          return {
            key: k,
            count: typeof count === 'number' ? count : Number(count ?? 0),
            ttl:
              typeof ttl === 'number'
                ? Math.ceil(ttl / 1000)
                : Number(ttl ?? -1),
          };
        })
        .catch(() => ({ key: k, count: 0, ttl: -1 }))
    )
  );

  // Filter out empty keys that were deleted by the cleanup script (ttl === -2)
  return results.filter((e) => e.ttl !== -2);
};

const deleteRateLimit = async (key: string): Promise<void> => {
  // Only allow deleting rate limit keys for safety
  if (!key.startsWith(RATE_LIMIT_PREFIX)) {
    throw new BadRequestError('Invalid rate limit key');
  }
  await redis.del(key);
};

const deleteAllRateLimits = async (): Promise<number> => {
  const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
  if (keys.length === 0) {
    return 0;
  }
  return await redis.del(...keys);
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
