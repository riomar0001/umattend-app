import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from '../../utils/customErrors';
import rateLimitStore from '../../configs/rateLimit.config';
import adminRepository from '../repositories/admin.repository';
import eventRepository from '../repositories/event.repository';
import { WINDOW_MS } from '../middlewares/rateLimiter.middleware';
import {
  ackMessages,
  pullMessages,
  type PulledMessage,
} from '../../configs/queuesApi.config';
import { getQueuesConfig } from '@/constants/queues.constants';
import { bindings } from '@/worker/runtime';
import { isDeadLetterEnvelope } from '@/worker/deadLetter';

const VALID_ROLES = ['student', 'admin', 'csg', 'instructor', 'organizer'];

// ---------------------------------------------------------------------------
// Dead-letter queue
// ---------------------------------------------------------------------------
//
// BullMQ kept every job in Redis, so the admin panel could count them, page
// through failures, and retry or delete an individual job by id. Cloudflare
// Queues has no equivalent for a queue with a Worker consumer — `umattend-email`
// and `umattend-event-status` are genuinely write-and-forget, and nothing here
// can report their depth.
//
// What *is* inspectable is the dead-letter queue, because it has an HTTP pull
// consumer instead of a Worker one. Everything below therefore operates on the
// DLQ only: it is the list of jobs that exhausted their retries, which is what
// the panel was for. See `configs/queuesApi.config.ts` for the lease semantics
// these functions depend on.
//
// What is still unavailable, and deliberately not faked:
//   - why a job failed. The DLQ carries the original message body verbatim; the
//     error lives only in the source consumer's catch block and Workers logs.
//   - waiting/active/delayed/completed counts. Those are BullMQ concepts.

/**
 * Short, so that a message pulled for display is visible again almost
 * immediately and a follow-up retry/delete can still find it.
 */
const LIST_VISIBILITY_MS = 1_000;

/**
 * Long enough that the ack issued a few statements later lands on a live lease.
 */
const ACTION_VISIBILITY_MS = 30_000;

/**
 * Acting on a job almost always follows listing it, and listing leases every
 * message it returns. Until that lease lapses the message is invisible, so a
 * single pull would report a job as gone when it is merely hidden — which is
 * indistinguishable, from the caller's side, from someone else having handled
 * it. Re-pull for a little longer than LIST_VISIBILITY_MS before believing it.
 */
const ACTION_ATTEMPTS = 4;
const ACTION_RETRY_DELAY_MS = 400;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pull until `find` matches, or the visibility window has certainly lapsed.
 * Returns the last batch pulled so callers can distinguish "queue is empty"
 * from "nothing matched".
 */
const pullForAction = async (
  dlq: string,
  find?: (message: PulledMessage) => boolean
): Promise<PulledMessage[]> => {
  let last: PulledMessage[] = [];

  for (let attempt = 0; attempt < ACTION_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(ACTION_RETRY_DELAY_MS);
    }

    const { messages, backlog } = await pullMessages(dlq, {
      batchSize: 100,
      visibilityTimeoutMs: ACTION_VISIBILITY_MS,
    });
    last = messages;

    if (find ? messages.some(find) : messages.length > 0) {
      return messages;
    }
    // Genuinely empty, rather than temporarily hidden — stop early.
    if (backlog === 0) {
      return messages;
    }
  }

  return last;
};

const dlqName = (): string => getQueuesConfig().dlq;

/**
 * Only the DLQ is readable. Passing anything else is a caller bug rather than
 * a missing feature, so it fails loudly instead of returning an empty list.
 */
const assertInspectable = (queueName: string): string => {
  const dlq = dlqName();
  if (queueName !== dlq) {
    throw new BadRequestError(
      `Only "${dlq}" can be inspected. Queues with a Worker consumer cannot be read.`
    );
  }
  return dlq;
};

/**
 * Unwrap a dead letter into the original job plus whatever context came with it.
 *
 * Two shapes arrive in the DLQ. Consumers that caught their own failure send an
 * envelope carrying the error (see worker/deadLetter.ts); anything the platform
 * dead-lettered — a crash or CPU timeout, where no catch ran — is the bare body.
 * The second kind has no reason to report, and says so rather than inventing one.
 */
const unwrap = (
  body: string
): { job: unknown; reason: string | null; queue: string | null; attempts: number | null; failedAt: number | null } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    // A message that is not JSON is still worth showing, just not parsed.
    return { job: { raw: body }, reason: null, queue: null, attempts: null, failedAt: null };
  }

  if (isDeadLetterEnvelope(parsed)) {
    const at = Date.parse(parsed.failed_at);
    return {
      job: parsed.body,
      reason: parsed.error,
      queue: parsed.queue,
      attempts: parsed.attempts,
      failedAt: Number.isNaN(at) ? null : at,
    };
  }

  return { job: parsed, reason: null, queue: null, attempts: null, failedAt: null };
};

const toJob = (message: PulledMessage) => {
  const { job, reason, queue, attempts, failedAt } = unwrap(message.body);

  const type =
    typeof job === 'object' && job !== null && 'type' in job
      ? String((job as { type: unknown }).type)
      : 'unknown';

  return {
    id: message.id,
    name: type,
    /**
     * The full job, unclipped. The detail sheet needs it, and fetching it
     * separately would mean a second pull — which costs a delivery attempt and
     * would race the lease the list itself just took. Response size is bounded
     * instead by only building jobs for the requested page (see getFailedJobs)
     * and by the 128KB ceiling Queues puts on a message.
     */
    data: job as Record<string, unknown>,
    failedReason: reason,
    /** Origin queue, when the consumer recorded it. */
    queue,
    /**
     * Deliveries from the *source* queue when known. `message.attempts` is the
     * DLQ's own counter, which counts every time this panel listed the job.
     */
    attemptsMade: attempts ?? message.attempts,
    timestamp: failedAt ?? message.timestamp_ms,
    finishedOn: null,
    processedOn: null,
  };
};

const getAllQueues = async () => {
  const { emailQueue, eventStatusQueue, dlq } = getQueuesConfig();
  return [
    {
      name: dlq,
      inspectable: true,
      note: 'Jobs that exhausted their retries.',
    },
    {
      name: emailQueue,
      inspectable: false,
      note: 'Worker consumer — depth and contents are not readable.',
    },
    {
      name: eventStatusQueue,
      inspectable: false,
      note: 'Worker consumer — depth and contents are not readable.',
    },
  ];
};

/**
 * `page` slices a single pulled batch rather than paging the queue: there is no
 * cursor, no ordering guarantee, and no way to address messages beyond the
 * first batch. `total` is the true backlog, so the UI can say when there is
 * more than one batch's worth.
 */
const getFailedJobs = async (
  queueName: string,
  page: number,
  limit: number
) => {
  const dlq = assertInspectable(queueName);

  const { messages, backlog } = await pullMessages(dlq, {
    batchSize: 100,
    visibilityTimeoutMs: LIST_VISIBILITY_MS,
  });

  // Slice before building jobs: bodies are returned whole, so mapping the full
  // batch would serialise up to 100 messages to send back ten.
  const start = (page - 1) * limit;
  const data = messages.slice(start, start + limit).map(toJob);

  return {
    data,
    backlog,
    truncated: backlog > messages.length,
    pagination: {
      page,
      limit,
      total: backlog,
      totalPages: Math.max(1, Math.ceil(messages.length / limit)),
    },
  };
};

/** Pull a batch and locate one message by its (pull-stable) id. */
const leaseById = async (dlq: string, jobId: string) => {
  const messages = await pullForAction(dlq, (m) => m.id === jobId);

  const message = messages.find((m) => m.id === jobId);
  if (!message) {
    throw new NotFoundError(
      'Job is no longer in the dead-letter queue — it may have expired, or another admin already handled it.'
    );
  }
  return message;
};

/**
 * Re-runs the original job by sending its body back to the producer queue, then
 * acknowledging the dead-lettered copy. The order matters: a failed `send()`
 * must leave the message in the DLQ rather than silently dropping it.
 */
const retryJob = async (queueName: string, jobId: string) => {
  const dlq = assertInspectable(queueName);
  const message = await leaseById(dlq, jobId);

  // Unwrap first: an enriched dead letter nests the real job under `body`, and
  // re-sending the envelope would enqueue the bookkeeping instead of the work.
  const { job } = unwrap(message.body);
  if (typeof job !== 'object' || job === null) {
    throw new BadRequestError('Job body is not valid JSON and cannot be retried.');
  }
  const body = job as { type?: string };

  const { EMAIL_QUEUE, EVENT_STATUS_QUEUE } = bindings();

  switch (body.type) {
    case 'send-email':
      await EMAIL_QUEUE.send(body as never);
      break;
    case 'event-start':
    case 'event-done':
      await EVENT_STATUS_QUEUE.send(body as never);
      break;
    default:
      throw new BadRequestError(
        `Unrecognised job type "${body.type ?? 'unknown'}"; refusing to retry.`
      );
  }

  await ackMessages(dlq, [message.lease_id]);
  return { id: jobId, retried: true };
};

const removeJob = async (queueName: string, jobId: string) => {
  const dlq = assertInspectable(queueName);
  const message = await leaseById(dlq, jobId);

  await ackMessages(dlq, [message.lease_id]);
  return { id: jobId, removed: true };
};

const retryAllFailed = async (queueName: string) => {
  const dlq = assertInspectable(queueName);
  const messages = await pullForAction(dlq);

  const { EMAIL_QUEUE, EVENT_STATUS_QUEUE } = bindings();
  const sent: string[] = [];
  const skipped: string[] = [];

  for (const message of messages) {
    try {
      const body = unwrap(message.body).job as { type?: string };
      if (body.type === 'send-email') {
        await EMAIL_QUEUE.send(body as never);
      } else if (body.type === 'event-start' || body.type === 'event-done') {
        await EVENT_STATUS_QUEUE.send(body as never);
      } else {
        skipped.push(message.id);
        continue;
      }
      sent.push(message.lease_id);
    } catch {
      // Leave anything that could not be re-sent in the queue.
      skipped.push(message.id);
    }
  }

  await ackMessages(dlq, sent);
  return { retried: sent.length, skipped: skipped.length };
};

const cleanAllFailed = async (queueName: string) => {
  const dlq = assertInspectable(queueName);
  const messages = await pullForAction(dlq);

  await ackMessages(
    dlq,
    messages.map((m) => m.lease_id)
  );
  return { removed: messages.length };
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
