import { Queue } from '../src/queue/Queue';
import { overrideRedis } from '../src/lib/redis/client';
import Redis from 'ioredis';

const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
overrideRedis(redis);

async function seed() {
  const queue = new Queue('main_queue');
  
  console.log('Seeding 15 random jobs...');
  for(let i=1; i<=15; i++) {
    const priority = i % 3 === 0 ? 'high' : (i % 2 === 0 ? 'low' : 'normal');
    // Using a type that might just hang or fail so it shows up in "stalled" or "failed" or just take some time 
    // Wait, the currently running server only processes 'noop' via benchmark if we did process, but index.ts hasn't registered handlers!
    // Let's check what handlers are registered in index.ts
    await queue.enqueue('example_task', { index: i, timestamp: Date.now() }, priority as any, 3);
  }
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);
