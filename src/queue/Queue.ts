import { v4 as uuidv4 } from 'uuid';
import { redis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { saveJob } from '../lib/redis/job-store';
import { Job, JobPriority, PRIORITIES } from '../types';
import { createLogger } from '../lib/logger';

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
    priority: JobPriority = 'normal',
    maxAttempts: number = 3,
  ): Promise<Job<T>> {
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
    await redis.lpush(RedisKeys.waitingList(this.queueName, priority), job.id);

    log.info('Job enqueued', { jobId: job.id, type, priority });
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
