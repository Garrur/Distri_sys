import { Redis } from 'ioredis';
import { Queue } from '../distri-sdk';

/**
 * Smoke test for the new distri-sdk.
 * Verifies that a standalone project can enqueue tasks precisely.
 */

async function runSmokeTest() {
  const redis = new Redis({ host: '127.0.0.1', port: 6379 });
  const queue = new Queue(redis, 'main_queue');

  console.log('--- DISTRI-SDK SMOKE TEST ---');
  
  try {
    const job = await queue.enqueue('example_task', { 
      source: 'SDK_SMOKE_TEST',
      timestamp: Date.now()
    }, { priority: 'high' });

    console.log('SUCCESS: Job enqueued via SDK');
    console.log(`Job ID: ${job.id}`);
    console.log(`Priority: ${job.priority}`);
    
    // Check Redis directly to confirm it's there
    const exists = await redis.exists(`job:${job.id}`);
    console.log(`Verified in Redis Hash: ${exists ? 'YES' : 'NO'}`);
    
    const queueLen = await redis.llen('queue:main_queue:waiting:high');
    console.log(`High Queue Depth: ${queueLen}`);

  } catch (err) {
    console.error('FAILED: SDK Smoke test errored');
    console.error(err);
  } finally {
    await redis.quit();
  }
}

runSmokeTest();
