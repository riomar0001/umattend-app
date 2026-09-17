/**
 * Cloudflare Queues REST client, for reading the dead-letter queue.
 *
 * Queue *bindings* are producer-only — a Worker can `send()` but never read —
 * so inspecting the DLQ means going back out to api.cloudflare.com. That is
 * only possible because the DLQ has an HTTP pull consumer attached; a queue
 * gets exactly one consumer, so the source queues (which have Worker consumers)
 * can never be read this way.
 *
 * Pull semantics that drive the callers in `admin.service.ts`:
 *
 *   - Pulling *leases* messages; it is not a peek. Every pull increments the
 *     message's `attempts`, and a message whose attempts exceed the consumer's
 *     max_retries is dropped. The consumers are provisioned with a retry budget
 *     of 100 so that browsing cannot destroy a message, but this is why the
 *     admin UI must not poll on a timer.
 *   - A pulled message is invisible for `visibility_timeout_ms`. List uses a
 *     deliberately short timeout so a follow-up retry/delete can still find the
 *     message; acting uses a longer one so the ack lands on a live lease.
 *   - Not acknowledging is how a read stays non-destructive: the lease lapses
 *     and the message returns.
 *
 * `id` is stable for a given message across pulls, so it works as the handle in
 * the admin routes. `lease_id` is not — it is reissued on every pull, and is
 * only valid for the pull that produced it.
 */

import { getQueuesConfig } from '@/constants/queues.constants';

const API_BASE = 'https://api.cloudflare.com/client/v4';

export interface PulledMessage {
  id: string;
  /** Decoded message body. Producers send `json`, so this is normally JSON. */
  body: string;
  timestamp_ms: number;
  attempts: number;
  lease_id: string;
  metadata: Record<string, string>;
}

export interface PullResult {
  messages: PulledMessage[];
  /** Total messages in the queue, including ones not in this batch. */
  backlog: number;
}

interface CloudflareResponse<T> {
  success: boolean;
  errors: { code?: number; message: string }[];
  result: T;
}

/**
 * Queue ids, resolved by name.
 *
 * The REST API addresses queues by id but everything else in this codebase
 * names them, and the ids differ per environment. Cached per isolate — a
 * queue's id never changes for a given name.
 */
const idCache = new Map<string, string>();

const request = async <T>(
  path: string,
  init: RequestInit = {}
): Promise<T> => {
  const { apiToken } = getQueuesConfig();

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  const payload = (await response.json()) as CloudflareResponse<T>;

  if (!payload.success) {
    const detail =
      payload.errors?.map((e) => e.message).join('; ') ||
      `HTTP ${response.status}`;
    throw new Error(`Cloudflare Queues API: ${detail}`);
  }

  return payload.result;
};

const resolveQueueId = async (queueName: string): Promise<string> => {
  const cached = idCache.get(queueName);
  if (cached) {
    return cached;
  }

  const { accountId } = getQueuesConfig();
  const queues = await request<{ queue_id: string; queue_name: string }[]>(
    `/accounts/${accountId}/queues`
  );

  for (const queue of queues) {
    idCache.set(queue.queue_name, queue.queue_id);
  }

  const id = idCache.get(queueName);
  if (!id) {
    throw new Error(`Queue "${queueName}" does not exist in this account.`);
  }
  return id;
};

/**
 * Bodies come back as a plain string for `json`/`text` messages and base64 for
 * `bytes`/`v8`. Producers here use the default content type, which is `json`
 * for any Worker with a compatibility date after 2024-03-18 — this project is
 * on 2025-09-15 — so the decode below is a guard for hand-pushed messages
 * rather than something the normal path relies on.
 */
const decodeBody = (
  body: string,
  metadata: Record<string, string> | undefined
): string => {
  const contentType = metadata?.['CF-Content-Type'];
  if (contentType === 'bytes' || contentType === 'v8') {
    try {
      return atob(body);
    } catch {
      return body;
    }
  }
  return body;
};

export const pullMessages = async (
  queueName: string,
  options: { batchSize?: number; visibilityTimeoutMs?: number } = {}
): Promise<PullResult> => {
  const { accountId } = getQueuesConfig();
  const queueId = await resolveQueueId(queueName);

  const result = await request<{
    messages: PulledMessage[];
    message_backlog_count: number;
  }>(`/accounts/${accountId}/queues/${queueId}/messages/pull`, {
    method: 'POST',
    body: JSON.stringify({
      // 100 is the API maximum.
      batch_size: Math.min(options.batchSize ?? 100, 100),
      visibility_timeout_ms: options.visibilityTimeoutMs ?? 30_000,
    }),
  });

  return {
    messages: (result.messages ?? []).map((message) => ({
      ...message,
      body: decodeBody(message.body, message.metadata),
    })),
    backlog: result.message_backlog_count ?? 0,
  };
};

/**
 * Acknowledging deletes a message permanently. `retries` puts it back on the
 * *same* queue — for the DLQ that means it stays dead-lettered, so re-running
 * the original job is a `send()` to the producer queue plus an ack here, never
 * a retry.
 */
export const ackMessages = async (
  queueName: string,
  leaseIds: string[]
): Promise<void> => {
  if (leaseIds.length === 0) {
    return;
  }

  const { accountId } = getQueuesConfig();
  const queueId = await resolveQueueId(queueName);

  await request(`/accounts/${accountId}/queues/${queueId}/messages/ack`, {
    method: 'POST',
    body: JSON.stringify({
      acks: leaseIds.map((lease_id) => ({ lease_id })),
      retries: [],
    }),
  });
};
