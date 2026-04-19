import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';

let redisContainer: StartedRedisContainer;
let redisClient: Redis;

export async function startRedisContainer(): Promise<Redis> {
  if (!redisClient) {
    try {
      redisContainer = await new RedisContainer('redis:7-alpine').start();
      const port = redisContainer.getFirstMappedPort();
      const host = redisContainer.getHost();
      const uri = `redis://${host}:${port}`;
      console.log(`Testcontainers Redis started at ${uri}`);
      redisClient = new Redis(uri);
    } catch (e) {
      console.log('Falling back to local Redis');
      const host = process.env.REDIS_HOST || '127.0.0.1';
      const port = Number(process.env.REDIS_PORT) || 6379;
      redisClient = new Redis({ host, port, maxRetriesPerRequest: null, enableReadyCheck: false });
    }
    
    // Wait for redis to be ready
    await new Promise<void>((resolve, reject) => {
      redisClient.once('ready', resolve);
      redisClient.once('error', reject);
    });
  }
  return redisClient;
}

export async function stopRedisContainer(): Promise<void> {
  if (redisClient) {
    try {
      if (redisClient.status === 'ready' || redisClient.status === 'connecting') {
        await redisClient.quit();
      }
    } catch { /* ignore double quit */ }
  }
  if (redisContainer) {
    await redisContainer.stop();
  }
}

export async function flushRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.flushall();
  }
}

export function getTestRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client is not initialized. Call startRedisContainer first.');
  }
  return redisClient;
}
