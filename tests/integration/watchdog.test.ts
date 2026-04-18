// These env vars MUST be set before ANY module is imported so that loadConfig()
// reads them on first call. In ts-jest, top-level statements run before imports.
process.env.HEARTBEAT_INTERVAL_MS = '200';
process.env.HEARTBEAT_TTL_SEC = '2';
process.env.WATCHDOG_INTERVAL_MS = '500';

// Force ts-jest to re-evaluate config with the new env vars
jest.resetModules();

import { overrideRedis, resetRedis } from '../../src/lib/redis/client';
import { Queue } from '../../src/queue/Queue';
import { WorkerPool } from '../../src/worker/WorkerPool';
import { Watchdog } from '../../src/worker/Watchdog';
import {
  startRedisContainer,
  stopRedisContainer,
  flushRedis,
  getTestRedisClient,
} from '../helpers/setupRedis';
import { waitFor } from '../helpers/waitFor';
import { RedisKeys } from '../../src/lib/redis/keys';

const QUEUE_NAME = 'watchdog_test_queue';

let queue: Queue;
let workerPool: WorkerPool;
let watchdog: Watchdog;
// AbortController lets us unblock the "hanging" handler during afterEach cleanup
let abortController: AbortController;

beforeAll(async () => {
  const containerClient = await startRedisContainer();
  overrideRedis(containerClient);
});

afterAll(async () => {
  await resetRedis();
  await stopRedisContainer();
});

beforeEach(async () => {
  await flushRedis();
  abortController = new AbortController();
  queue = new Queue(QUEUE_NAME);
  workerPool = new WorkerPool(QUEUE_NAME, 1);
  watchdog = new Watchdog(QUEUE_NAME);
});

afterEach(async () => {
  // NOTE: watchdog.stop() is called INSIDE the test body after assertions,
  // so we must NOT stop it here — it could race against the test's waitFor.
  // We only abort the stalled handler and drain the pool.
  abortController.abort();
  // Give shutdown a maximum of 3s to drain after unblocking the handler
  await Promise.race([
    workerPool.shutdown(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  // Final safety: stop watchdog if it wasn't already stopped inside test body
  watchdog.stop();
});

describe('Watchdog Failover Architecture', () => {
  it('Test case — watchdog requeues a stalled job when heartbeat disappears', async () => {
    let stalledHandlerStarted = false;

    // Register a handler for "stall-test" that hangs until aborted
    workerPool.process('stall-test', async () => {
      stalledHandlerStarted = true;
      // Hangs until afterEach aborts it — preventing normal "completed" resolution
      await new Promise<void>((resolve) => {
        abortController.signal.addEventListener('abort', () => resolve());
      });
    });

    // Enqueue 1 job with type "stall-test"
    const job = await queue.enqueue('stall-test', { fail: true }, 'normal', 3);

    // Start WorkerPool and Watchdog
    await workerPool.start();
    watchdog.start();

    // Use waitFor() to confirm the handler has started (job is now active & stuck)
    await waitFor(() => stalledHandlerStarted === true, 5000);

    const redis = getTestRedisClient();

    // Manually delete the heartbeat key to simulate a crashed worker.
    // Also destroy the timer interval by stopping the pool's heartbeat path is handled
    // inside WorkerPool — but we have a direct handle on the key here.
    //
    // Why deleting the heartbeat key instead of killing the process:
    //
    // Killing the Node process (SIGKILL) would tear down the entire Jest runner.
    // In production, if a worker crashes (OOM, SIGKILL, network partition), the
    // heartbeat key simply stops being renewed and expires after its TTL.
    // Deleting the key manually achieves the exact same observable effect on the
    // Watchdog's MGET check — null returned for that slot — triggering recovery.
    // This is the correct, precise, non-destructive way to simulate a worker crash.
    const hbKey = RedisKeys.heartbeat(job.id);
    // Keep deleting in a loop to prevent the still-running hbTimer inside WorkerPool
    // from re-setting the key before the Watchdog's TTL check runs.
    const killHeartbeat = setInterval(() => redis.del(hbKey).catch(() => {}), 100);

    // Use waitFor: Heartbeat TTL = 2s + watchdog poll 0.5s = ~2.5s minimum.
    // Give it 10s to be safe against timer jitter.
    await waitFor(async () => {
      const status = await redis.hget(RedisKeys.jobHash(job.id), 'status');
      return status === 'waiting';
    }, 10000);

    clearInterval(killHeartbeat);

    // HGET: Assert job status field in the Hash is "waiting" (job was requeued)
    const finalStatus = await redis.hget(RedisKeys.jobHash(job.id), 'status');
    expect(finalStatus).toBe('waiting');

    // HEXISTS: Assert job is no longer tracked in the active_jobs Hash
    const activeKey = RedisKeys.activeJobsHash(QUEUE_NAME);
    const activeExists = await redis.hexists(activeKey, job.id);
    expect(activeExists).toBe(0);

    // HGET: Assert attempts counter incremented from 0 to 1 by the Watchdog
    const attempts = await redis.hget(RedisKeys.jobHash(job.id), 'attempts');
    expect(attempts).toBe('1');

    // Stop the watchdog now that assertions are complete
    watchdog.stop();
  });
});
