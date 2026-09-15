/**
 * Producer for the "mark event started" transition.
 *
 * Both event transitions share one Cloudflare queue, discriminated by message
 * `type`; this module keeps the old per-queue import surface intact for
 * `event.service.ts`.
 *
 * `remove()` is a no-op: Cloudflare Queues cannot withdraw an enqueued message.
 * Cancellation is handled instead by the consumer, which reloads the event and
 * re-derives whether it is actually due — see
 * `src/worker/consumers/eventStatus.consumer.ts`.
 */

import { bindings } from '../../worker/runtime';

interface AddOptions {
  delay?: number;
  jobId?: string;
}

export const startEventStatusQueue = {
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
      { type: 'event-start', event_id: data.event_id },
      { delaySeconds }
    );
  },

  async remove(_jobId: string): Promise<void> {
    // Intentionally empty — see module docblock.
  },
};

export default startEventStatusQueue;
