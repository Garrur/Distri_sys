import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { Redis } from 'ioredis';
import { overrideRedis, resetRedis } from '../src/lib/redis/client';
import { RedisKeys } from '../src/lib/redis/keys';
import { Queue } from '../src/queue/Queue';
import { WorkerPool } from '../src/worker/WorkerPool';
import { Scheduler } from '../src/scheduler/Scheduler';
import { Watchdog } from '../src/worker/Watchdog';
import { Job } from '../src/types';

/**
 * Integration tests for the distributed task queue.
 *
 * Strategy:
 *  - If Docker is available → spins up an ephemeral Redis via testcontainers.
 *  - If Docker is unavailable → falls back to a local Redis on 127.0.0.1:6379.
 */

let container: StartedTestContainer | null = null;
let testRedis: Redis;

const QUEUE = 'test_queue';

// ─── Global Setup ────────────────────────────────────────────────────────────
beforeAll(async () => {
  let host: string;
  let port: number;

  try {
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();
    host = container.getHost();
    port = container.getMappedPort(6379);
  } catch {
    host = process.env.REDIS_HOST || '127.0.0.1';
    port = Number(process.env.REDIS_PORT) || 6379;
  }

  testRedis = new Redis({ host, port, maxRetriesPerRequest: null, enableReadyCheck: false });
  await testRedis.ping();
  overrideRedis(testRedis);
}, 60_000);

afterAll(async () => {
  if (testRedis) try { testRedis.disconnect(); } catch { /* ignore */ }
  if (container) await container.stop();
}, 30_000);

afterEach(async () => {
  if (testRedis) await testRedis.flushall();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 100): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tick = async () => {
      try { if (await predicate()) return resolve(); } catch { /* retry */ }
      if (Date.now() > deadline) return reject(new Error('waitUntil timed out'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function safeShutdownPool(pool: WorkerPool): Promise<void> {
  await pool.shutdown();
}

// ── 1. Basic flow ────────────────────────────────────────────────────────────
describe('Basic flow', () => {
  it('should process all 10 enqueued jobs within 5 seconds', async () => {
    const queue = new Queue(QUEUE);
    const pool  = new WorkerPool(QUEUE, 3);
    const completed: string[] = [];

    pool.process('basic', async (job: Job) => { completed.push(job.id); });

    const jobs: Job[] = [];
    for (let i = 0; i < 10; i++) {
      jobs.push(await queue.enqueue('basic', { index: i }, 'normal', 3) as Job);
    }

    await pool.start();
    await waitUntil(() => Promise.resolve(completed.length === 10), 5_000);

    expect(completed.length).toBe(10);
    for (const job of jobs) {
      const status = await testRedis.hget(RedisKeys.jobHash(job.id), 'status');
      expect(status).toBe('completed');
    }

    await safeShutdownPool(pool);
  });
});

// ── 2. Retry logic ───────────────────────────────────────────────────────────
describe('Retry logic', () => {
  it('should succeed on the 3rd attempt after 2 failures', async () => {
    const queue     = new Queue(QUEUE);
    const pool      = new WorkerPool(QUEUE, 1);
    const scheduler = new Scheduler(QUEUE);
    let attemptCount = 0;

    pool.process('retry_test', async () => {
      attemptCount++;
      if (attemptCount < 3) throw new Error(`Deliberate failure #${attemptCount}`);
    });

    const job = await queue.enqueue('retry_test', { value: 42 }, 'normal', 5) as Job;
    scheduler.start();
    await pool.start();

    const forceTimer = setInterval(async () => {
      const delayed = await testRedis.zrange(RedisKeys.delayedSet(QUEUE), 0, -1);
      for (const id of delayed) await testRedis.zadd(RedisKeys.delayedSet(QUEUE), 0, id);
    }, 200);

    await waitUntil(async () => {
      const s = await testRedis.hget(RedisKeys.jobHash(job.id), 'status');
      return s === 'completed';
    }, 15_000);

    clearInterval(forceTimer);
    expect(attemptCount).toBe(3);
    expect(await testRedis.hget(RedisKeys.jobHash(job.id), 'status')).toBe('completed');

    await scheduler.stop();
    await safeShutdownPool(pool);
  });
});

// ── 3. Dead-letter queue ─────────────────────────────────────────────────────
describe('Dead-letter queue', () => {
  it('should move a perpetually failing job to the dead-letter queue', async () => {
    const queue     = new Queue(QUEUE);
    const pool      = new WorkerPool(QUEUE, 1);
    const scheduler = new Scheduler(QUEUE);
    const maxAttempts = 3;

    pool.process('always_fail', async () => { throw new Error('I always fail'); });
    const job = await queue.enqueue('always_fail', {}, 'normal', maxAttempts) as Job;

    scheduler.start();
    await pool.start();

    const forceTimer = setInterval(async () => {
      const delayed = await testRedis.zrange(RedisKeys.delayedSet(QUEUE), 0, -1);
      for (const id of delayed) await testRedis.zadd(RedisKeys.delayedSet(QUEUE), 0, id);
    }, 200);

    await waitUntil(async () => (await testRedis.llen(RedisKeys.deadList(QUEUE))) > 0, 20_000);
    clearInterval(forceTimer);

    expect(await testRedis.lrange(RedisKeys.deadList(QUEUE), 0, -1)).toContain(job.id);
    expect(await testRedis.hget(RedisKeys.jobHash(job.id), 'status')).toBe('dead');
    expect(parseInt((await testRedis.hget(RedisKeys.jobHash(job.id), 'attempts'))!, 10)).toBe(maxAttempts);

    await scheduler.stop();
    await safeShutdownPool(pool);
  });
});

// ── 4. Priority ordering ─────────────────────────────────────────────────────
describe('Priority ordering', () => {
  it('should process jobs in strict high → normal → low order', async () => {
    const queue = new Queue(QUEUE);

    await queue.enqueue('prio', { p: 'low' },    'low',    1);
    await queue.enqueue('prio', { p: 'low' },    'low',    1);
    await queue.enqueue('prio', { p: 'normal' }, 'normal', 1);
    await queue.enqueue('prio', { p: 'normal' }, 'normal', 1);
    await queue.enqueue('prio', { p: 'high' },   'high',   1);
    await queue.enqueue('prio', { p: 'high' },   'high',   1);

    const order: string[] = [];
    const pool = new WorkerPool(QUEUE, 1);
    pool.process('prio', async (job: Job) => { order.push((job.data as { p: string }).p); });

    await pool.start();
    await waitUntil(() => Promise.resolve(order.length === 6), 5_000);
    await safeShutdownPool(pool);

    expect(order.slice(0, 2)).toEqual(['high', 'high']);
    expect(order.slice(2, 4)).toEqual(['normal', 'normal']);
    expect(order.slice(4, 6)).toEqual(['low', 'low']);
  });
});

// ── 5. Stalled job recovery ──────────────────────────────────────────────────
describe('Stalled job recovery', () => {
  it('should detect a stalled job and requeue it', async () => {
    const queue = new Queue(QUEUE);
    const job = await queue.enqueue('stall_test', { msg: 'will stall' }, 'normal', 5) as Job;

    // Simulate crashed worker: register active + heartbeat with short TTL, then don't renew
    await testRedis.hset(RedisKeys.jobHash(job.id), 'status', 'active');
    await testRedis.hset(
      RedisKeys.activeJobsHash(QUEUE), job.id,
      JSON.stringify({ workerId: 99, startedAt: Date.now(), timeout: 30000 }),
    );
    await testRedis.set(RedisKeys.heartbeat(job.id), '1', 'EX', 2);
    await testRedis.rpoplpush(RedisKeys.waitingList(QUEUE, 'normal'), RedisKeys.processingList(QUEUE));

    // Wait for heartbeat to expire
    await new Promise((r) => setTimeout(r, 3_000));

    // Manually trigger watchdog
    const watchdog = new Watchdog(QUEUE);
    await (watchdog as any).checkStalledJobs();

    expect(await testRedis.hget(RedisKeys.jobHash(job.id), 'status')).toBe('waiting');
    expect(parseInt((await testRedis.hget(RedisKeys.jobHash(job.id), 'attempts'))!, 10)).toBe(1);
    expect(await testRedis.lrange(RedisKeys.waitingList(QUEUE, 'normal'), 0, -1)).toContain(job.id);
    expect(await testRedis.hget(RedisKeys.activeJobsHash(QUEUE), job.id)).toBeNull();
    expect(await testRedis.get(RedisKeys.heartbeat(job.id))).toBeNull();

    await watchdog.stop();
  });
});
