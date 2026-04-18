import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { createLogger } from './lib/logger';
import { resetRedis } from './lib/redis/client';
import { jobRoutes } from './api/routes';
import { Queue } from './queue/Queue';

const log = createLogger('Server');
const fastify = Fastify({ logger: false });

fastify.register(cors, { 
  origin: '*', 
  methods: ['GET', 'POST']
});

const queue = new Queue(config.queue.name);

// Mount REST API
fastify.register(jobRoutes, { queueName: config.queue.name });

// Quick test endpoint
fastify.post('/jobs/test', async () => {
  const job = await queue.enqueue('example_task', { message: 'Hello from distributed queue!' }, 'high', 3);
  return { success: true, job };
});

async function start(): Promise<void> {
  try {
    await fastify.listen({ port: config.api.port, host: config.api.host });
    log.info('Server listening', { port: config.api.port, host: config.api.host });
  } catch (err) {
    log.error('Startup failed', { error: String(err) });
    process.exit(1);
  }
}

async function shutdown(): Promise<void> {
  log.info('Shutdown signal received');
  await fastify.close();
  await resetRedis();
  log.info('Clean shutdown complete');
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

start();
