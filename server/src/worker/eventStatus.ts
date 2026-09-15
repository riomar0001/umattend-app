/**
 * When an event becomes due to flip `is_started` / `is_done`.
 *
 * Derived from the stored row rather than from whenever a job happened to be
 * scheduled. That is what lets the queue consumer and the cron sweep re-check
 * an event at any time and reach the same answer — the property that replaces
 * BullMQ's remove-and-reschedule on update.
 *
 * All-day events carry no explicit times, so they fall back to `created_at`
 * and `created_at + 24h`, matching the 0ms / 24h delays the BullMQ scheduler
 * used to apply at creation time.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SchedulableEvent {
  id: string;
  all_day: boolean;
  start_time: Date | null;
  end_time: Date | null;
  created_at: Date;
}

export const startDueAt = (event: SchedulableEvent): Date | null => {
  if (event.start_time) {
    return event.start_time;
  }
  return event.all_day ? event.created_at : null;
};

export const doneDueAt = (event: SchedulableEvent): Date | null => {
  if (event.end_time) {
    return event.end_time;
  }
  if (!event.all_day) {
    return null;
  }
  const anchor = event.start_time ?? event.created_at;
  return new Date(anchor.getTime() + DAY_MS);
};
