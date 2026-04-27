import { Counter, Gauge, Histogram } from 'prom-client';
import register from './index.js';

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const bullmqJobsCompletedTotal = new Counter({
  name: 'bullmq_jobs_completed_total',
  help: 'Total number of completed BullMQ jobs',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobsFailedTotal = new Counter({
  name: 'bullmq_jobs_failed_total',
  help: 'Total number of failed BullMQ jobs',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobDurationSeconds = new Histogram({
  name: 'bullmq_job_duration_seconds',
  help: 'BullMQ job processing duration in seconds',
  labelNames: ['queue'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
  registers: [register],
});

export const bullmqJobsWaiting = new Gauge({
  name: 'bullmq_jobs_waiting',
  help: 'Number of BullMQ jobs currently waiting',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobsActive = new Gauge({
  name: 'bullmq_jobs_active',
  help: 'Number of BullMQ jobs currently active',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobsDelayed = new Gauge({
  name: 'bullmq_jobs_delayed',
  help: 'Number of BullMQ jobs currently delayed',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobsCompleted = new Gauge({
  name: 'bullmq_jobs_completed',
  help: 'Number of BullMQ jobs completed (from Redis)',
  labelNames: ['queue'],
  registers: [register],
});

export const bullmqJobsFailed = new Gauge({
  name: 'bullmq_jobs_failed',
  help: 'Number of BullMQ jobs failed (from Redis)',
  labelNames: ['queue'],
  registers: [register],
});
