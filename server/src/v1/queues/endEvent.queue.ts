import { Queue, Worker } from 'bullmq';
import prisma from '../../configs/prisma.config';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
} from '../../constants/redis.constants';
import {
  bullmqJobsCompletedTotal,
  bullmqJobsFailedTotal,
  bullmqJobDurationSeconds,
} from '../../telemetry/metrics.js';

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const endEventStatusQueue = new Queue('event-end-status-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnFail: false,
  },
});

const endEventStatusWorker = new Worker(
  'event-end-status-queue',
  async (job) => {
    const { event_id } = job.data;

    console.log(`Checking event ${event_id} status`);

    await prisma.events.update({
      where: { id: event_id },
      data: { is_done: true },
    });

    console.log(`Event ${event_id} marked as done.`);
  },
  { connection, concurrency: 1 }
);

endEventStatusWorker.on('completed', (job) => {
  console.log(`Job completed for event ${job.data.event_id}`);
  bullmqJobsCompletedTotal.inc({ queue: 'event-end-status-queue' });
  if (job.finishedOn && job.processedOn) {
    bullmqJobDurationSeconds.observe(
      { queue: 'event-end-status-queue' },
      (job.finishedOn - job.processedOn) / 1000
    );
  }
});

endEventStatusWorker.on('failed', (job, err) => {
  console.error(`Job failed for event ${job?.data?.event_id}:`, err);
  bullmqJobsFailedTotal.inc({ queue: 'event-end-status-queue' });
});
