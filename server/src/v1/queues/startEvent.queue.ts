import { Queue, Worker } from 'bullmq';
import prisma from '../../configs/prisma.config';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
  REDIS_DB,
} from '../../constants/redis.constants';
import {
  bullmqJobsCompletedTotal,
  bullmqJobsFailedTotal,
  bullmqJobDurationSeconds,
} from '../../telemetry/metrics.js';
import { startQueueMetricsPolling } from '../../telemetry/queueMetrics.js';

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  db: REDIS_DB,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const startEventStatusQueue = new Queue('event-start-status-queue', {
  connection,
});

const startEventStatusWorker = new Worker(
  'event-start-status-queue',
  async (job) => {
    const { event_id } = job.data;

    console.log(`Checking event ${event_id} start status`);

    await prisma.events.update({
      where: { id: event_id },
      data: { is_started: true },
    });

    console.log(`Event ${event_id} marked as started.`);
  },
  { connection, concurrency: 1 }
);

startEventStatusWorker.on('completed', (job) => {
  console.log(`Start job completed for event ${job.data.event_id}`);
  bullmqJobsCompletedTotal.inc({ queue: 'event-start-status-queue' });
  if (job.finishedOn && job.processedOn) {
    bullmqJobDurationSeconds.observe(
      { queue: 'event-start-status-queue' },
      (job.finishedOn - job.processedOn) / 1000
    );
  }
});

startEventStatusWorker.on('failed', (job, err) => {
  console.error(`Start job failed for event ${job?.data?.event_id}:`, err);
  bullmqJobsFailedTotal.inc({ queue: 'event-start-status-queue' });
});

startQueueMetricsPolling(startEventStatusQueue, 'event-start-status-queue');
