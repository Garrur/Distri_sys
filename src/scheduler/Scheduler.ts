import { redis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { config } from '../config';
import { createLogger } from '../lib/logger';

const log = createLogger('Scheduler');

/**
 * Scheduler — moves due delayed jobs back to their priority waiting queue.
 *
 * Polls the delayed sorted set every `config.scheduler.intervalMs` and
 * atomically transfers any job whose score (due timestamp) ≤ now.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;

  constructor(private readonly queueName: string) {}

  public start(): void {
    if (this.timer) return;
    log.info('Started', { queue: this.queueName, intervalMs: config.scheduler.intervalMs });
    this.timer = setInterval(() => {
      this.currentRun = this.processDelayedJobs().catch((err) =>
        log.error('Delayed-job check failed', { error: String(err) }),
      );
    }, config.scheduler.intervalMs);
  }

  public async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      if (this.currentRun) await this.currentRun;
      log.info('Stopped');
    }
  }

  /**
   * Redis commands: ZRANGEBYSCORE → (ZREM + LPUSH + HSET) per job via MULTI.
   */
  private async processDelayedJobs(): Promise<void> {
    const delayedKey = RedisKeys.delayedSet(this.queueName);
    const dueJobs = await redis.zrangebyscore(delayedKey, '-inf', Date.now());
    if (dueJobs.length === 0) return;

    log.info('Moving delayed jobs', { count: dueJobs.length });

    for (const jobId of dueJobs) {
      const priority = (await redis.hget(RedisKeys.jobHash(jobId), 'priority')) || 'normal';
      const targetKey = RedisKeys.waitingList(this.queueName, priority);

      const pipe = redis.multi();
      pipe.zrem(delayedKey, jobId);
      pipe.lpush(targetKey, jobId);
      pipe.hset(RedisKeys.jobHash(jobId), 'status', 'waiting');
      await pipe.exec();

      log.info('Delayed job moved to waiting', { jobId, priority });
    }
  }
}
