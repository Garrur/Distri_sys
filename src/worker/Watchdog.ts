import { redis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { updateJobFields } from '../lib/redis/job-store';
import { config } from '../config';
import { createLogger } from '../lib/logger';

const log = createLogger('Watchdog');

/**
 * Watchdog — detects stalled jobs via heartbeat expiry.
 *
 * ## Why heartbeats instead of TTLs on the job hash?
 *
 * A TTL on the job key itself is dangerous: if a legitimate job takes
 * longer than the TTL to process (e.g. a slow API call), Redis expires
 * the key and the system incorrectly treats a healthy worker's job as
 * dead, leading to duplicate execution.
 *
 * A decoupled heartbeat solves this: the worker renews a separate
 * `heartbeat:<id>` key every few seconds. If the key expires, it means
 * the worker process itself has crashed or its event loop is blocked —
 * a genuine failure, not just a slow task. This cleanly separates
 * "worker is dead" from "task is slow".
 */
export class Watchdog {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly queueName: string) {}

  public start(): void {
    if (this.timer) return;
    log.info('Started', { queue: this.queueName, intervalMs: config.watchdog.intervalMs });
    this.timer = setInterval(() => {
      this.checkStalledJobs().catch((err) =>
        log.error('Stall check failed', { error: String(err) }),
      );
    }, config.watchdog.intervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('Stopped');
    }
  }

  private async checkStalledJobs(): Promise<void> {
    const activeKey = RedisKeys.activeJobsHash(this.queueName);
    const activeJobs = await redis.hgetall(activeKey);
    const jobIds = Object.keys(activeJobs);
    if (jobIds.length === 0) return;

    // Batch-check all heartbeats with a single MGET
    const hbKeys = jobIds.map((id) => RedisKeys.heartbeat(id));
    const heartbeats = await redis.mget(hbKeys);

    for (let i = 0; i < jobIds.length; i++) {
      if (heartbeats[i] !== null) continue; // Still alive

      const jobId = jobIds[i];
      log.warn('Stalled job detected', { jobId });

      await redis.hdel(activeKey, jobId);

      const jobHash = await redis.hgetall(RedisKeys.jobHash(jobId));
      if (!jobHash || Object.keys(jobHash).length === 0) continue;

      const attempts = parseInt(jobHash.attempts, 10) + 1;
      const priority = jobHash.priority || 'normal';
      const targetKey = RedisKeys.waitingList(this.queueName, priority);

      const pipe = redis.multi();
      pipe.hmset(RedisKeys.jobHash(jobId), { attempts: attempts.toString(), status: 'waiting' });
      pipe.lpush(targetKey, jobId);
      await pipe.exec();

      log.info('Stalled job requeued', { jobId, attempts, priority });
    }
  }
}
