import { Redis } from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Job, JobPriority } from './types';
import { RedisKeys } from './keys';
import { saveJob } from './job-store';

/**
 * Queue Producer SDK.
 * 
 * Drop this class into any project to start enqueuing tasks
 * into the Distributed Task Queue.
 */
export class Queue {
  private readonly redis: Redis;
  private readonly queueName: string;

  /**
   * @param redisClient An active ioredis instance.
   * @param queueName Target queue name (must match worker config).
   */
  constructor(redisClient: Redis, queueName: string = 'main_queue') {
    this.redis = redisClient;
    this.queueName = queueName;
  }

  /**
   * Enqueues a new job into the system.
   */
  public async enqueue<T>(
    type: string,
    data: T,
    options: {
      priority?: JobPriority;
      maxAttempts?: number;
    } = {}
  ): Promise<Job<T>> {
    const { priority = 'normal', maxAttempts = 3 } = options;

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

    // 1. Persist the job hash
    await saveJob(this.redis, job as any);

    // 2. Push ID to the priority-specific list
    await this.redis.lpush(
      RedisKeys.waitingList(this.queueName, priority),
      job.id
    );

    return job;
  }
}
