import { overrideRedis, resetRedis } from '../../src/lib/redis/client';
import { Queue } from '../../src/queue/Queue';
import { WorkerPool } from '../../src/worker/WorkerPool';
import { Scheduler } from '../../src/scheduler/Scheduler';
import { startRedisContainer, stopRedisContainer, flushRedis, getTestRedisClient } from '../helpers/setupRedis';
import { waitFor } from '../helpers/waitFor';
import { RedisKeys } from '../../src/lib/redis/keys';
import { Job } from '../../src/types';

const QUEUE_NAME = 'test_queue';

let queue: Queue;
let workerPool: WorkerPool;
let scheduler: Scheduler;

beforeAll(async () => {
  // 1. Spin up the real Testcontainers Redis
  const containerClient = await startRedisContainer();
  // 2. Inject it into our core system's singleton so tests and workers use the container
  overrideRedis(containerClient);
});

afterAll(async () => {
  await resetRedis();
  await stopRedisContainer();
});

beforeEach(async () => {
  // Ensure pristine state across all tests
  await flushRedis();
  
  queue = new Queue(QUEUE_NAME);
  workerPool = new WorkerPool(QUEUE_NAME, 1);
  scheduler = new Scheduler(QUEUE_NAME);
});

afterEach(async () => {
  // Clean up loops
  await workerPool.shutdown();
  scheduler.stop();
});

describe('Retry and DLQ Logic', () => {

  it('Test case 1 — job succeeds on 3rd attempt', async () => {
    let localAttempts = 0;

    // Register a handler that fails twice, then succeeds
    workerPool.process('flaky-job', async (job) => {
      localAttempts++;
      if (localAttempts < 3) {
        throw new Error(`Failing on purpose, attempt ${localAttempts}`);
      }
      // Succeeds on attempt 3
    });

    // Enqueue 1 job with maxAttempts: 3
    const job = await queue.enqueue(
      'flaky-job',
      { foo: 'bar' },
      'normal',
      3
    ) as Job;

    // Start WorkerPool and Scheduler (since Scheduler moves delayed jobs back to waiting)
    await workerPool.start();
    scheduler.start();

    // Use waitFor() to assert job status becomes "completed" within 10 seconds
    const redis = getTestRedisClient();
    await waitFor(async () => {
      const status = await redis.hget(RedisKeys.jobHash(job.id), 'status');
      return status === 'completed';
    }, 10000);

    // Assert attempts counter in Redis hash equals 2 
    // (We assert 2 because it failed twice, writing 1 then 2 to the DB. The 3rd attempt succeeds and doesn't write an attempt increment)
    // HGET check to verify the attempts field inside the job's hash metadata
    const finalAttempts = await redis.hget(RedisKeys.jobHash(job.id), 'attempts');
    expect(finalAttempts).toBe('2');
    
    // Assert job is NOT in dead letter queue
    // LLEN check ensures the dead queue list is completely empty
    const dlqLength = await redis.llen(RedisKeys.deadList(QUEUE_NAME));
    expect(dlqLength).toBe(0);
  });

  it('Test case 2 — job lands in dead letter after exhausting retries', async () => {
    // Register a handler that always throws new Error("permanent failure")
    workerPool.process('poison-job', async () => {
      throw new Error('permanent failure');
    });

    // Enqueue 1 job with maxAttempts: 2
    const job = await queue.enqueue(
      'poison-job',
      { fatal: true },
      'normal',
      2
    ) as Job;

    // Start WorkerPool and Scheduler
    await workerPool.start();
    scheduler.start();

    // Use waitFor() to assert job status becomes "dead" within 10 seconds
    const redis = getTestRedisClient();
    await waitFor(async () => {
      const status = await redis.hget(RedisKeys.jobHash(job.id), 'status');
      return status === 'dead';
    }, 10000);

    // Assert job ID exists in the dead_letter Redis list
    // LRANGE 0 -1 fetches all elements from the dead list to confirm the job was pushed
    const deadJobs = await redis.lrange(RedisKeys.deadList(QUEUE_NAME), 0, -1);
    expect(deadJobs).toContain(job.id);

    // Assert attempts counter equals 2
    // HGET check to verify the exact failure threshold was met
    const finalAttempts = await redis.hget(RedisKeys.jobHash(job.id), 'attempts');
    expect(finalAttempts).toBe('2');
  });

});
