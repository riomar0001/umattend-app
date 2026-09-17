import getEnv from '@/utils/envHandler';

/**
 * Queue names and Cloudflare API credentials, read lazily.
 *
 * Same constraint as `smtp.constants` — this module is reachable from the
 * Worker's static graph, so `getEnv()` must not run at module scope. See the
 * comment there for why that fails the deploy rather than the request.
 */

export interface QueuesConfig {
  accountId: string;
  apiToken: string;
  /** Producer queues, for re-sending a dead-lettered message. */
  emailQueue: string;
  eventStatusQueue: string;
  /** The dead-letter queue both producers feed. */
  dlq: string;
}

export const getQueuesConfig = (): QueuesConfig => ({
  accountId: getEnv('CF_ACCOUNT_ID'),
  // Needs Queues Read *and* Write: a pull consumer writes queue state in order
  // to acknowledge, so a read-only token cannot even list messages.
  apiToken: getEnv('CF_API_TOKEN'),
  emailQueue: getEnv('EMAIL_QUEUE_NAME'),
  eventStatusQueue: getEnv('EVENT_STATUS_QUEUE_NAME'),
  dlq: getEnv('DLQ_NAME'),
});
