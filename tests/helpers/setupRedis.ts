import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';

let redisContainer: StartedRedisContainer;
let redisClient: Redis;

export async function startRedisContainer(): Promise<Redis> {
  if (!redisContainer) {
    redisContainer = await new RedisContainer('redis:7-alpine').start();
    const port = redisContainer.getFirstMappedPort();
    const host = redisContainer.getHost();
    const uri = `redis://${host}:${port}`;
    console.log(`Testcontainers Redis started at ${uri}`);
    redisClient = new Redis(uri);
    
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
    await redisClient.quit();
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
