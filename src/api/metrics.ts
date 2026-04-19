import { Counter, Histogram, Gauge, register } from 'prom-client';

export const distriJobsEnqueuedTotal = new Counter({
  name: 'distri_jobs_enqueued_total',
  help: 'Total number of jobs enqueued',
  labelNames: ['queue'],
});

export const distriJobsCompletedTotal = new Counter({
  name: 'distri_jobs_completed_total',
  help: 'Total number of successfully completed jobs',
  labelNames: ['job_type'],
});

export const distriJobsFailedTotal = new Counter({
  name: 'distri_jobs_failed_total',
  help: 'Total number of failed jobs',
  labelNames: ['job_type', 'final'],
});

export const distriJobsProcessingDuration = new Histogram({
  name: 'distri_jobs_processing_duration_seconds',
  help: 'Time from dequeue to completion or failure',
  labelNames: ['job_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

export const distriQueueDepth = new Gauge({
  name: 'distri_queue_depth',
  help: 'Current depth of job queues',
  labelNames: ['queue'],
});

export const getMetrics = async () => {
  return await register.metrics();
};
