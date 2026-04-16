import { FastifyPluginAsync } from 'fastify';
import { redis } from '../lib/redis/client';
import { RedisKeys } from '../lib/redis/keys';
import { getJob, updateJobFields } from '../lib/redis/job-store';
import { StatsResponse, JobListResponse, RetryResponse, Job } from '../types';
import { JobNotFoundError, InvalidJobStatusError } from '../errors';
import { createLogger } from '../lib/logger';

const log = createLogger('API');

export interface ApiOptions {
  queueName: string;
}

export const jobRoutes: FastifyPluginAsync<ApiOptions> = async (fastify, { queueName }) => {

  // ── GET /stats ─────────────────────────────────────────────────────────────

  fastify.get<{ Reply: StatsResponse }>('/stats', async (_req, reply) => {
    const pipe = redis.multi();
    pipe.llen(RedisKeys.waitingList(queueName, 'high'));
    pipe.llen(RedisKeys.waitingList(queueName, 'normal'));
    pipe.llen(RedisKeys.waitingList(queueName, 'low'));
    pipe.zcard(RedisKeys.delayedSet(queueName));
    pipe.llen(RedisKeys.deadList(queueName));
    pipe.get(RedisKeys.jobsProcessedTotal);
    pipe.get(RedisKeys.jobsFailedTotal);
    pipe.get(RedisKeys.processingTimeSum);

    const r = await pipe.exec();
    if (!r) return reply.code(500).send({ error: 'Pipeline failed' } as any);

    const processed = parseInt((r[5][1] as string) || '0', 10);
    const failed    = parseInt((r[6][1] as string) || '0', 10);
    const timeSum   = parseInt((r[7][1] as string) || '0', 10);

    return {
      queues: {
        high:    r[0][1] as number,
        normal:  r[1][1] as number,
        low:     r[2][1] as number,
        delayed: r[3][1] as number,
        dead:    r[4][1] as number,
      },
      metrics: {
        jobs_processed_total: processed,
        jobs_failed_total: failed,
        avg_processing_time_ms: processed > 0 ? timeSum / processed : 0,
      },
    };
  });

  // ── GET /jobs/:id ──────────────────────────────────────────────────────────

  fastify.get<{ Params: { id: string } }>('/jobs/:id', async (req, reply) => {
    const job = await getJob(redis, req.params.id);
    if (!job) return reply.code(404).send({ error: 'Job not found' });
    return job;
  });

  // ── GET /jobs?status=<status>&limit=20&offset=0 ────────────────────────────

  fastify.get<{
    Querystring: { status: string; limit?: string; offset?: string };
    Reply: JobListResponse;
  }>('/jobs', async (req, reply) => {
    const { status, limit = '20', offset = '0' } = req.query;

    let listKey: string;
    let isZset = false;

    switch (status) {
      case 'failed':
      case 'dead':    listKey = RedisKeys.deadList(queueName); break;
      case 'delayed': listKey = RedisKeys.delayedSet(queueName); isZset = true; break;
      case 'waiting': listKey = RedisKeys.waitingList(queueName, 'normal'); break;
      case 'high':    listKey = RedisKeys.waitingList(queueName, 'high'); break;
      case 'low':     listKey = RedisKeys.waitingList(queueName, 'low'); break;
      default:
        return reply.code(400).send({ error: `Unsupported status filter: ${status}` } as any);
    }

    const start = parseInt(offset, 10);
    const stop  = start + parseInt(limit, 10) - 1;

    const jobIds = isZset
      ? await redis.zrange(listKey, start, stop)
      : await redis.lrange(listKey, start, stop);

    if (jobIds.length === 0) return { jobs: [] };

    // Fetch all job hashes in a single pipeline
    const pipe = redis.multi();
    for (const id of jobIds) pipe.hgetall(RedisKeys.jobHash(id));
    const results = await pipe.exec();

    const jobs: Job[] = (results ?? [])
      .map((res) => {
        const hash = res[1] as Record<string, string>;
        if (!hash || Object.keys(hash).length === 0) return null;
        return {
          ...hash,
          data: JSON.parse(hash.data),
          attempts: parseInt(hash.attempts, 10),
          maxAttempts: parseInt(hash.maxAttempts, 10),
          createdAt: parseInt(hash.createdAt, 10),
        } as unknown as Job;
      })
      .filter((j): j is Job => j !== null);

    return { jobs };
  });

  // ── POST /jobs/:id/retry ───────────────────────────────────────────────────

  fastify.post<{ Params: { id: string }; Reply: RetryResponse }>('/jobs/:id/retry', async (req, reply) => {
    const { id } = req.params;
    const job = await getJob(redis, id);

    if (!job) return reply.code(404).send({ error: 'Job not found' } as any);

    if (job.status !== 'dead' && job.status !== 'failed') {
      return reply.code(400).send({ error: `Cannot retry job with status "${job.status}". Only dead/failed jobs can be retried.` } as any);
    }

    const waitingKey = RedisKeys.waitingList(queueName, job.priority);
    const deadKey    = RedisKeys.deadList(queueName);

    const pipe = redis.multi();
    pipe.lrem(deadKey, 0, id);
    pipe.hmset(RedisKeys.jobHash(id), { status: 'waiting', attempts: '0' });
    pipe.lpush(waitingKey, id);
    await pipe.exec();

    log.info('Job manually retried', { jobId: id });
    return { message: `Job ${id} requeued for processing.` };
  });
};
