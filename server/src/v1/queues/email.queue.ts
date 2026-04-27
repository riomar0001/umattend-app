import { Queue, Worker, JobsOptions } from 'bullmq';
import { transporter } from '../../configs/smtp.config';
import { EmailJob } from '../interface/email';
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

export const emailQueue = new Queue<EmailJob>('email-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  } as JobsOptions,
});

const emailWorker = new Worker<EmailJob>(
  'email-queue',
  async (job) => {
    const { to, subject, html } = job.data;

    try {
      await transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        html,
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  },
  {
    connection,
    limiter: {
      max: 1,
      duration: 10000,
    },
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed for ${job.data.to}`);
  bullmqJobsCompletedTotal.inc({ queue: 'email-queue' });
  if (job.finishedOn && job.processedOn) {
    bullmqJobDurationSeconds.observe(
      { queue: 'email-queue' },
      (job.finishedOn - job.processedOn) / 1000
    );
  }
});

emailWorker.on('failed', (job, err) => {
  console.error(
    `Job ${job?.id} failed after ${job?.attemptsMade} attempts:`,
    err
  );
  bullmqJobsFailedTotal.inc({ queue: 'email-queue' });
});

startQueueMetricsPolling(emailQueue, 'email-queue');
