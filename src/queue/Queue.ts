import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { saveJob } from '../lib/redis/job-store';
import { Job, JobPriority, PRIORITIES } from '../types';
import { createLogger } from '../lib/logger';
import { distriJobsEnqueuedTotal } from '../api/metrics';

const log = createLogger('Queue');

/**
 * Queue — the producer side of the distributed task queue.
 *
 * Responsible for creating job records in Redis and pushing
 * their IDs into the appropriate priority waiting list.
 */
export class Queue {
  constructor(private readonly queueName: string) {}

  /**
   * Enqueues a new job.
   *
   * Redis commands: HMSET (job hash), LPUSH (waiting list).
   */
  public async enqueue<T>(
    type: string,
    data: T,
    optionsOrPriority?: JobPriority | { priority?: JobPriority; maxAttempts?: number; idempotencyKey?: string },
    legacyMaxAttempts?: number
  ): Promise<Job<T> | string> {
    let priority: JobPriority = 'normal';
    let maxAttempts = 3;
    let idempotencyKey: string | undefined;

    if (typeof optionsOrPriority === 'object' && optionsOrPriority !== null) {
      priority = optionsOrPriority.priority ?? 'normal';
      maxAttempts = optionsOrPriority.maxAttempts ?? 3;
      idempotencyKey = optionsOrPriority.idempotencyKey;
    } else if (typeof optionsOrPriority === 'string') {
      priority = optionsOrPriority;
      maxAttempts = legacyMaxAttempts ?? 3;
    }

    const job: Job<T> = {
      id: uuidv4(),
      type,
      data,
      status: 'waiting',
      priority,
      attempts: 0,
      maxAttempts,
      createdAt: Date.now(),
    };

    await saveJob(redis, job as Job);

    if (idempotencyKey) {
      const waitList = RedisKeys.waitingList(this.queueName, priority);
      const idempotencyRedisKey = `idempotency:${idempotencyKey}`;
      
      const claimedId = await redis.idempotentEnqueue(
        idempotencyRedisKey,
        waitList,
        job.id,
        "86400"
      );

      if (claimedId !== job.id) {
        log.info('Idempotency collision — job skipped', { originalId: job.id, claimedId, type, idempotencyKey });
        // Clean up the orphaned job hash since we didn't actually push it to the waiting list
        await redis.del(RedisKeys.jobHash(job.id));
        return claimedId;
      }
    } else {
      await redis.lpush(RedisKeys.waitingList(this.queueName, priority), job.id);
    }

    distriJobsEnqueuedTotal.inc({ queue: priority });
    
    log.info('Job enqueued', { jobId: job.id, type, priority, idempotencyKey });
    return job;
  }

  /**
   * Returns the number of waiting jobs per priority level.
   *
   * Redis commands: LLEN × 3 via pipeline.
   */
  public async getQueueDepths(): Promise<Record<JobPriority, number>> {
    const pipe = redis.multi();
    for (const p of PRIORITIES) {
      pipe.llen(RedisKeys.waitingList(this.queueName, p));
    }
    const results = await pipe.exec();
    return {
      high:   (results?.[0]?.[1] as number) ?? 0,
      normal: (results?.[1]?.[1] as number) ?? 0,
      low:    (results?.[2]?.[1] as number) ?? 0,
    };
  }
}
