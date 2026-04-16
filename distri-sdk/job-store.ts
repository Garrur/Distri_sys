import { Redis } from 'ioredis';
import { Job } from './types';
import { RedisKeys } from './keys';

/**
 * Serialization logic for the distri-sdk.
 */

export function serializeJob(job: Job): Record<string, string> {
  return {
    id:          job.id,
    type:        job.type,
    data:        JSON.stringify(job.data),
    status:      job.status,
    priority:    job.priority,
    attempts:    job.attempts.toString(),
    maxAttempts: job.maxAttempts.toString(),
    createdAt:   job.createdAt.toString(),
  };
}

export async function saveJob(client: Redis, job: Job): Promise<void> {
  await client.hmset(RedisKeys.jobHash(job.id), serializeJob(job));
}
