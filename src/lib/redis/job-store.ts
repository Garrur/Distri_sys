import { Redis } from 'ioredis';
import { Job, JobStatus, JobPriority } from '../../types';
import { RedisKeys } from './keys';

// ── Serialization ────────────────────────────────────────────────────────────

/** Convert a Job object to a flat string hash for Redis HMSET. */
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

/** Reconstruct a Job from the flat hash returned by HGETALL. */
export function deserializeJob(hash: Record<string, string>): Job {
  return {
    id:          hash.id,
    type:        hash.type,
    data:        JSON.parse(hash.data),
    status:      hash.status as JobStatus,
    priority:    (hash.priority as JobPriority) || 'normal',
    attempts:    parseInt(hash.attempts, 10),
    maxAttempts: parseInt(hash.maxAttempts, 10),
    createdAt:   parseInt(hash.createdAt, 10),
  };
}

// ── CRUD Operations ──────────────────────────────────────────────────────────

/** Persist a full Job to Redis as a hash. */
export async function saveJob(client: Redis, job: Job): Promise<void> {
  await client.hmset(RedisKeys.jobHash(job.id), serializeJob(job));
}

/** Fetch a Job by ID. Returns null if not found. */
export async function getJob(client: Redis, id: string): Promise<Job | null> {
  const hash = await client.hgetall(RedisKeys.jobHash(id));
  if (!hash || Object.keys(hash).length === 0) return null;
  return deserializeJob(hash);
}

/** Partially update specific fields of a job hash. */
export async function updateJobFields(
  client: Redis,
  id: string,
  fields: Partial<Record<string, string>>,
): Promise<void> {
  await client.hmset(RedisKeys.jobHash(id), fields);
}
