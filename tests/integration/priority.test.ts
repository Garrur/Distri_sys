import { overrideRedis, resetRedis } from '../../src/lib/redis/client';
import { Queue } from '../../src/queue/Queue';
import { WorkerPool } from '../../src/worker/WorkerPool';
import { startRedisContainer, stopRedisContainer, flushRedis } from '../helpers/setupRedis';
import { waitFor } from '../helpers/waitFor';

const QUEUE_NAME = 'priority_test_queue';

let queue: Queue;
let workerPool: WorkerPool;

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
  queue = new Queue(QUEUE_NAME);
  // Create WorkerPool with concurrency: 1 so only one job runs at a time
  workerPool = new WorkerPool(QUEUE_NAME, 1);
});

afterEach(async () => {
  await workerPool.shutdown();
});

describe('Strict Priority Ordering', () => {

  it('Test case — jobs process in strict priority order with concurrency 1', async () => {
    const processedOrder: string[] = [];

    // Register a handler for job type "priority-test"
    workerPool.process('priority-test', async (job) => {
      // Pushes job.data.label into processedOrder
      const data = job.data as { label: string };
      processedOrder.push(data.label);
      
      // Waits 50ms (simulate work) before resolving
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Enqueue 3 jobs in this exact non-sorted order:
    await queue.enqueue('priority-test', { label: 'normal' }, 'normal', 1);
    await queue.enqueue('priority-test', { label: 'low' }, 'low', 1);
    await queue.enqueue('priority-test', { label: 'high' }, 'high', 1);

    /**
     * Explanation of Priority Mechanism:
     * We don't use complex background loops to sort priorities. Instead, we use Redis Lists.
     * WorkerPool calls: `BRPOP queue:test_queue:high queue:test_queue:normal queue:test_queue:low 0`
     * 
     * BRPOP naturally resolves strictly from left-to-right across the provided list keys. 
     * Even though 'normal' and 'low' were inserted chronologically FIRST, the WorkerPool
     * passes 'high' as the first list argument to BRPOP. Thus, BRPOP instantly pulls the 
     * 'high' task giving us robust priority queueing absolutely free of any sorting overhead.
     */

    // Start the WorkerPool AFTER all 3 jobs are enqueued
    await workerPool.start();

    // Use waitFor() to assert processedOrder.length === 3 within 5 seconds
    await waitFor(() => processedOrder.length === 3, 5000);

    // Assert processedOrder equals ["high", "normal", "low"]
    expect(processedOrder).toEqual(['high', 'normal', 'low']);
  });

});
