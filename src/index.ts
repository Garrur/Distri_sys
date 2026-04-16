import Fastify from 'fastify';
import { config } from './config';
import { createLogger } from './lib/logger';
import { redis, resetRedis } from './lib/redis/client';
import { jobRoutes } from './api/routes';
import { Queue } from './queue/Queue';
import { WorkerPool } from './worker/WorkerPool';
import { Watchdog } from './worker/Watchdog';
import { Scheduler } from './scheduler/Scheduler';

const log = createLogger('Main');

// ── Application bootstrap ────────────────────────────────────────────────────

const fastify = Fastify({ logger: false }); // We use our own structured logger

const queue     = new Queue(config.queue.name);
const pool      = new WorkerPool(config.queue.name, config.worker.concurrency);
const watchdog  = new Watchdog(config.queue.name);
const scheduler = new Scheduler(config.queue.name);

// Mount REST API
fastify.register(jobRoutes, { queueName: config.queue.name });

// Quick test endpoint
fastify.post('/jobs/test', async () => {
  const job = await queue.enqueue('example_task', { message: 'Hello from distributed queue!' }, 'high', 3);
  return { success: true, job };
});

// ── Start ────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  try {
    // Register a demo handler
    pool.process('example_task', async (job) => {
      log.info('Processing example task', { jobId: job.id, data: job.data });
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));
      if (Math.random() < 0.2) throw new Error('Simulated failure');
    });

    await pool.start();
    watchdog.start();
    scheduler.start();

    await fastify.listen({ port: config.api.port, host: config.api.host });
    log.info('Server listening', { port: config.api.port, host: config.api.host });
  } catch (err) {
    log.error('Startup failed', { error: String(err) });
    process.exit(1);
  }
}

// ── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  log.info('Shutdown signal received');

  watchdog.stop();
  scheduler.stop();
  await pool.shutdown();
  await fastify.close();
  await resetRedis();

  log.info('Clean shutdown complete');
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

start();
