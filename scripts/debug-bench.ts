// Quick probe: test with concurrency=10 specifically
process.env.LOG_LEVEL = 'silent';

import Redis from 'ioredis';
import { overrideRedis } from '../src/lib/redis/client';
import { Queue } from '../src/queue/Queue';
import { WorkerPool } from '../src/worker/WorkerPool';

const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
overrideRedis(redis);

async function main() {
  await redis.flushall();
  
  const queue = new Queue('bench_queue');
  const pool = new WorkerPool('bench_queue', 10); // Test with 10 concurrency
  
  let completed = 0;
  const total = 20;

  pool.process('noop', async () => {
    completed++;
    console.log(`Job ${completed}/${total}`);
  });

  for (let i = 0; i < total; i++) {
    await queue.enqueue('noop', {}, 'normal', 1);
  }
  console.log('All jobs enqueued. Starting workers with concurrency=10...');
  
  const start = Date.now();
  await pool.start();

  while (completed < total && Date.now() - start < 15000) {
    await new Promise(r => setTimeout(r, 200));
    console.log(`... waiting, completed=${completed}`);
  }

  console.log(`DONE: ${completed}/${total} in ${Date.now() - start}ms`);
  await pool.shutdown();
  await redis.quit();
}

main().catch(console.error);
