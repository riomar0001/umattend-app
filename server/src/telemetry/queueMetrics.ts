import type { Queue } from 'bullmq';
import {
  bullmqJobsWaiting,
  bullmqJobsActive,
  bullmqJobsDelayed,
  bullmqJobsCompleted,
  bullmqJobsFailed,
} from './metrics.js';

const POLL_INTERVAL_MS = 30_000;

export function startQueueMetricsPolling(queue: Queue, queueName: string) {
  const poll = async () => {
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed'
      );
      bullmqJobsWaiting.set({ queue: queueName }, counts.waiting ?? 0);
      bullmqJobsActive.set({ queue: queueName }, counts.active ?? 0);
      bullmqJobsDelayed.set({ queue: queueName }, counts.delayed ?? 0);
      bullmqJobsCompleted.set({ queue: queueName }, counts.completed ?? 0);
      bullmqJobsFailed.set({ queue: queueName }, counts.failed ?? 0);
    } catch {
      // Queue not yet connected — ignore
    }
  };

  poll();
  const interval = setInterval(poll, POLL_INTERVAL_MS);

  if (typeof interval?.unref === 'function') {
    interval.unref();
  }
}
