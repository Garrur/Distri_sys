import { redis as sharedRedis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { deserializeJob, updateJobFields } from '../lib/redis/job-store';
import { Job, JobHandler, ActiveJobEntry, PRIORITIES } from '../types';
import { HandlerNotRegisteredError } from '../errors';
import { config } from '../config';
import { createLogger } from '../lib/logger';
import { distriJobsCompletedTotal, distriJobsFailedTotal, distriJobsProcessingDuration } from '../api/metrics';

const log = createLogger('WorkerPool');

// ── Backoff Utility ──────────────────────────────────────────────────────────

/**
 * Calculates exponential backoff delay with jitter.
 * delay = min(maxDelay, 1000 × 2^attempt) + random(0, jitter)
 */
export function calculateBackoff(attempt: number): number {
  const base = Math.min(config.backoff.maxDelayMs, 1000 * Math.pow(2, attempt));
  return base + Math.floor(Math.random() * (config.backoff.jitterMs + 1));
}

// ── WorkerPool ───────────────────────────────────────────────────────────────

/**
 * Manages N concurrent workers, each with a dedicated Redis connection
 * for blocking BRPOP. Includes heartbeat registration, exponential-backoff
 * retry, and dead-letter routing.
 *
 * Why N connections? BRPOP blocks the entire TCP socket. Sharing one
 * connection would serialize all workers into a single sequential loop,
 * destroying concurrency. Each worker therefore gets its own connection
 * exclusively for the blocking pop.
 */
export class WorkerPool {
  private isRunning = false;
  private runningJobCount = 0;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly workerPromises: Promise<void>[] = [];

  constructor(
    private readonly queueName: string,
    private readonly concurrency: number = config.worker.concurrency,
  ) {}

  /** Register a processor function for a given job type. */
  public process(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  /** Boot exactly `concurrency` worker loops. */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    log.info('Starting workers', { concurrency: this.concurrency, queue: this.queueName });

    for (let i = 0; i < this.concurrency; i++) {
      this.workerPromises.push(this.workerLoop(i + 1));
    }
    Promise.all(this.workerPromises).catch((err) =>
      log.error('Critical worker failure', { error: String(err) }),
    );
  }

  public async shutdown(): Promise<void> {
    log.info('Initiating shutdown');
    this.isRunning = false;

    await Promise.allSettled(this.workerPromises);
    this.workerPromises.length = 0;

    log.info('Shutdown complete');
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async workerLoop(workerId: number): Promise<void> {
    const processList = RedisKeys.processingList(this.queueName);
    const keys = PRIORITIES.map((p) => RedisKeys.waitingList(this.queueName, p));

    while (this.isRunning) {
      try {
        let jobId: string | null = null;
        // Priority polling using atomic LMOVE to processList to prevent Pop-Crash race
        for (const listKey of keys) {
          jobId = await sharedRedis.rpoplpush(listKey, processList);
          if (jobId) break;
        }

        if (!jobId) {
          if (this.isRunning) await new Promise((r) => setTimeout(r, 100));
          continue;
        }

        this.runningJobCount++;
        try {
          await this.processJob(jobId, workerId);
        } finally {
          this.runningJobCount--;
        }
      } catch (err) {
        if (this.isRunning) {
          log.error('Poll loop error', { workerId, error: String(err) });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  }

  private async processJob(jobId: string, workerId: number): Promise<void> {
    const jobHash = await sharedRedis.hgetall(RedisKeys.jobHash(jobId));
    if (!jobHash || Object.keys(jobHash).length === 0) {
      log.warn('Job not found, skipping', { jobId });
      return;
    }

    const job: Job = deserializeJob(jobHash);
    await sharedRedis.hset(RedisKeys.jobHash(jobId), 'status', 'active');
    job.status = 'active';

    const handler = this.handlers.get(job.type);
    if (!handler) {
      log.error('No handler registered', { jobId, type: job.type });
      await sharedRedis.hset(RedisKeys.jobHash(jobId), 'status', 'failed');
      return;
    }

    // Register in active-jobs hash & start heartbeat
    const activeKey = RedisKeys.activeJobsHash(this.queueName);
    const hbKey     = RedisKeys.heartbeat(jobId);
    const entry: ActiveJobEntry = { workerId, startedAt: Date.now(), timeout: config.backoff.maxDelayMs };

    await sharedRedis.hset(activeKey, jobId, JSON.stringify(entry));
    await sharedRedis.set(hbKey, '1', 'EX', config.worker.heartbeatTtlSec);

    const hbTimer = setInterval(() => {
      sharedRedis.set(hbKey, '1', 'EX', config.worker.heartbeatTtlSec).catch(() => {});
    }, config.worker.heartbeatIntervalMs);

    const startTime = Date.now();
    try {
      await handler(job);

      const elapsed = Date.now() - startTime;
      const pipe = sharedRedis.multi();
      pipe.hset(RedisKeys.jobHash(jobId), 'status', 'completed');
      pipe.incr(RedisKeys.jobsProcessedTotal);
      pipe.incrby(RedisKeys.processingTimeSum, elapsed);
      await pipe.exec();

      distriJobsCompletedTotal.inc({ job_type: job.type });
      distriJobsProcessingDuration.observe({ job_type: job.type }, elapsed / 1000);

      log.info('Job completed', { jobId, type: job.type, durationMs: elapsed });

    } catch (err) {
      log.error('Job failed', { jobId, type: job.type, error: String(err) });
      await sharedRedis.incr(RedisKeys.jobsFailedTotal);
      
      const elapsed = Date.now() - startTime;
      distriJobsProcessingDuration.observe({ job_type: job.type }, elapsed / 1000);

      const nextAttempt = job.attempts + 1;

      if (nextAttempt < job.maxAttempts) {
        distriJobsFailedTotal.inc({ job_type: job.type, final: 'false' });
        const delay = calculateBackoff(nextAttempt);
        await updateJobFields(sharedRedis, jobId, {
          status: 'delayed',
          attempts: nextAttempt.toString(),
        });
        await sharedRedis.zadd(RedisKeys.delayedSet(this.queueName), Date.now() + delay, jobId);
        log.info('Job delayed for retry', { jobId, attempt: nextAttempt, maxAttempts: job.maxAttempts, delayMs: delay });
      } else {
        distriJobsFailedTotal.inc({ job_type: job.type, final: 'true' });
        await updateJobFields(sharedRedis, jobId, {
          status: 'dead',
          attempts: nextAttempt.toString(),
        });
        await sharedRedis.lpush(RedisKeys.deadList(this.queueName), jobId);
        log.warn('Job moved to dead-letter queue', { jobId, attempts: nextAttempt });
      }
    } finally {
      clearInterval(hbTimer);
      const pipe = sharedRedis.multi();
      pipe.hdel(activeKey, jobId);
      pipe.del(hbKey);
      pipe.lrem(RedisKeys.processingList(this.queueName), 1, jobId);
      await pipe.exec();
    }
  }
}
