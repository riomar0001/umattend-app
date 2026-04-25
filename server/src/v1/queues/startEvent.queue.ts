import { Queue, Worker } from 'bullmq';
import prisma from '../../configs/prisma.config';
import {
  REDIS_HOST,
  REDIS_PORT,
  REDIS_USERNAME,
  REDIS_PASSWORD,
} from '../../constants/redis.constants';

const connection = {
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
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
});

startEventStatusWorker.on('failed', (job, err) => {
  console.error(`Start job failed for event ${job?.data?.event_id}:`, err);
});
