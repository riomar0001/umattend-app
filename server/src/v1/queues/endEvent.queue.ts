/**
 * Producer for the "mark event done" transition.
 *
 * See `startEvent.queue.ts` — same queue, same cancellation semantics.
 */

import { bindings } from '../../worker/runtime';

interface AddOptions {
  delay?: number;
  jobId?: string;
}

export const endEventStatusQueue = {
  async add(
    _name: string,
    data: { event_id: string },
    options: AddOptions = {}
  ): Promise<void> {
    const delaySeconds = Math.min(
      Math.max(0, Math.ceil((options.delay ?? 0) / 1000)),
      86_400
    );

    await bindings().EVENT_STATUS_QUEUE.send(
      { type: 'event-done', event_id: data.event_id },
      { delaySeconds }
    );
  },

  async remove(_jobId: string): Promise<void> {
    // Intentionally empty — cancellation is handled consumer-side.
  },
};

export default endEventStatusQueue;
