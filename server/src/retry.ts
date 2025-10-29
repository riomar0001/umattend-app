import { Queue, QueueEvents } from 'bullmq';

const connection = {
  host: 'redis-11700.c16.us-east-1-3.ec2.redns.redis-cloud.com',
  port: Number(11700),
  username: 'default',
  password: '35ic0lhOYpRvzRItpXuSFtfwQdbyCcGX',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const queueName = 'email-queue';
const queue = new Queue(queueName, { connection });
const queueEvents = new QueueEvents(queueName, { connection });

// Helper to wait for a specific job’s result
async function waitForJobResult(jobId: string) {
  return new Promise<{
    status: 'completed' | 'failed';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result?: any;
    failedReason?: unknown;
  }>((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onCompleted = ({ jobId: completedId, returnvalue }: any) => {
      if (completedId === jobId) {
        queueEvents.off('completed', onCompleted);
        queueEvents.off('failed', onFailed);
        resolve({ status: 'completed', result: returnvalue });
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onFailed = ({ jobId: failedId, failedReason }: any) => {
      if (failedId === jobId) {
        queueEvents.off('completed', onCompleted);
        queueEvents.off('failed', onFailed);
        resolve({ status: 'failed', failedReason });
      }
    };

    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);
  });
}

// Helper to sleep
function sleep(ms: number) {
  // eslint-disable-next-line no-undef
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryAllFailedJobs() {
  const failedJobs = await queue.getFailed();

  if (failedJobs.length === 0) {
    console.log('🎉 No failed jobs to retry.');
    await queueEvents.close();
    await queue.close();
    return;
  }

  console.log(`🔁 Retrying ${failedJobs.length} failed jobs...`);

  for (const job of failedJobs) {
    console.log(`↩️ Retrying job ${job.id}...`);
    try {
      await job.retry();

      const result = await waitForJobResult(job.id as string);
      if (result.status === 'completed') {
        console.log(`✅ Job ${job.id} succeeded`);
      } else {
        console.log(`❌ Job ${job.id} failed again: ${result.failedReason}`);
      }
    } catch (error) {
      console.error(`⚠️ Failed to retry job ${job.id}:`, error);
    }

    console.log('⏳ Waiting 10 seconds before next retry...');
    await sleep(10_000); // wait 10 seconds
  }

  console.log('✅ All failed jobs have been retried and processed.');
  await queueEvents.close();
  await queue.close();
}

retryAllFailedJobs();
