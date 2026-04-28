import { Queue, Job } from 'bullmq';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/customErrors';
import { emailQueue } from '../queues/email.queue';
import { startEventStatusQueue } from '../queues/startEvent.queue';
import { endEventStatusQueue } from '../queues/endEvent.queue';
import adminRepository from '../repositories/admin.repository';
import eventRepository from '../repositories/event.repository';

const VALID_ROLES = ['student', 'admin', 'csg', 'instructor', 'organizer'];

const QUEUE_MAP: Record<string, Queue> = {
  'email-queue': emailQueue,
  'event-start-status-queue': startEventStatusQueue,
  'event-end-status-queue': endEventStatusQueue,
};

function resolveQueue(name: string): Queue {
  const q = QUEUE_MAP[name];
  if (!q) throw new NotFoundError(`Queue "${name}" not found`);
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
    stacktrace: (job as any).stacktrace ?? [],
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
  if (!job) throw new NotFoundError(`Job "${jobId}" not found`);
  await job.retry();
  return { jobId, retried: true };
};

const removeJob = async (queueName: string, jobId: string) => {
  const queue = resolveQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) throw new NotFoundError(`Job "${jobId}" not found`);
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
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batchRemoved = await queue.clean(0, BATCH, 'failed');
    removed += batchRemoved.length;
    if (batchRemoved.length < BATCH) break;
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
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const updateUserRole = async (userId: string, role: string) => {
  if (!VALID_ROLES.includes(role)) {
    throw new BadRequestError(
      `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`
    );
  }

  const existing = await adminRepository.findUserById(userId);
  if (!existing) throw new NotFoundError('User not found');

  return await adminRepository.updateUserRole(userId, role);
};

const softDeleteUser = async (userId: string) => {
  const existing = await adminRepository.findUserById(userId);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.deleted_at) {
    throw new ConflictError('User is already deleted');
  }
  await adminRepository.softDeleteUser(userId);
  return { userId, deleted: true };
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

const getAllEvents = async (
  page: number,
  limit: number,
  search?: string
) => {
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

const updateEvent = async (eventId: string, eventData: any) => {
  const existing = await eventRepository.getEventDetails(eventId);
  if (!existing) throw new NotFoundError('Event not found');

  // Admin override — bypasses the created_by check in eventService.updateEvent
  return await eventRepository.updateEvent(eventId, eventData);
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
};

export default adminService;
