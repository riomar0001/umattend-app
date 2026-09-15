/**
 * Message shapes carried on Cloudflare Queues.
 *
 * These replace BullMQ job payloads. Unlike BullMQ, Cloudflare Queues has no
 * notion of a mutable job that can be removed or rescheduled after the fact, so
 * messages here are treated as *hints* ("this event may be due now") and the
 * consumer re-derives the truth from the database before acting.
 */

/** Mirrors `EmailJob`, so producers can spread a job straight onto it. */
export interface EmailMessage {
  type: 'send-email';
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export type EventStatusKind = 'event-start' | 'event-done';

export interface EventStatusMessage {
  type: EventStatusKind;
  event_id: string;
}

/**
 * Cloudflare Queues caps per-message delivery delay at 24 hours. Anything
 * further out is delivered in hops of this size, each one re-enqueuing the
 * remainder (see `eventStatus.consumer`).
 */
export const MAX_DELAY_SECONDS = 86_400;

/** Clamp an absolute due-time into a legal `delaySeconds` value. */
export const delayUntil = (dueAt: Date | number): number => {
  const ms = (dueAt instanceof Date ? dueAt.getTime() : dueAt) - Date.now();
  const seconds = Math.ceil(ms / 1000);
  if (seconds <= 0) {
    return 0;
  }
  return Math.min(seconds, MAX_DELAY_SECONDS);
};
