import { config } from './config';
import { createLogger } from './lib/logger';
import { resetRedis } from './lib/redis/client';
import { WorkerPool } from './worker/WorkerPool';
import { Watchdog } from './worker/Watchdog';
import { Scheduler } from './scheduler/Scheduler';

const log = createLogger('WorkerNode');

const pool      = new WorkerPool(config.queue.name, config.worker.concurrency);
const watchdog  = new Watchdog(config.queue.name);
const scheduler = new Scheduler(config.queue.name);

async function start(): Promise<void> {
  try {
    // Register demo handler
    pool.process('example_task', async (job) => {
      log.info('Processing example task', { jobId: job.id, data: job.data });
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));
      if (Math.random() < 0.2) throw new Error('Simulated failure');
    });

    await pool.start();
    watchdog.start();
    scheduler.start();
    
    log.info('Worker Node Boot Sequence Complete', { queue: config.queue.name, concurrency: config.worker.concurrency });
  } catch (err) {
    log.error('Startup failed', { error: String(err) });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  log.info('Shutdown signal received');

  watchdog.stop();
  scheduler.stop();
  await pool.shutdown();
  await resetRedis();

  log.info('Clean shutdown complete');
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

start();
