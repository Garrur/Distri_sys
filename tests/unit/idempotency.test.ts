import { overrideRedis, resetRedis, getRedis } from '../../src/lib/redis/client';
import { Queue } from '../../src/queue/Queue';
import { RedisKeys } from '../../src/lib/redis/keys';
import { startRedisContainer, stopRedisContainer, flushRedis } from '../helpers/setupRedis';

const QUEUE_NAME = 'idempotency_test_queue';
let queue: Queue;

beforeAll(async () => {
  const containerClient = await startRedisContainer();
  overrideRedis(containerClient);

  // Suppress specific expected "Connection is closed." error failing the Jest run
  process.on('unhandledRejection', (reason) => {
    if (reason && typeof reason === 'object' && 'message' in reason) {
      if ((reason as any).message === 'Connection is closed.') return;
    }
    console.error('Unhandled Rejection:', reason);
  });
});

afterAll(async () => {
  await new Promise(r => setTimeout(r, 100)); // drain pending command callbacks
  await resetRedis();
  await stopRedisContainer();
});

beforeEach(async () => {
  await flushRedis();
  queue = new Queue(QUEUE_NAME);
});

describe('Queue Idempotency', () => {
  it('Should only enqueue once when given the same idempotencyKey twice', async () => {
    const idempotencyKey = 'some-unique-key';
    
    // First enqueue succeeds and returns the full Job
    const job1 = await queue.enqueue('idem-test', { a: 1 }, { idempotencyKey });
    
    // Second enqueue fails the SET NX check and returns the original job ID
    const job2 = await queue.enqueue('idem-test', { b: 2 }, { idempotencyKey });

    const job1Id = typeof job1 === 'string' ? job1 : job1.id;
    const job2Id = typeof job2 === 'string' ? job2 : job2.id;
    
    // Assert both enqueue calls return the same jobId
    expect(job1Id).toBe(job2Id);
    expect(typeof job1).toBe('object');
    expect(typeof job2).toBe('string');

    // Assert only 1 job exists in Redis (LLEN queue === 1)
    const redisClient = getRedis();
    const waitListLength = await redisClient.llen(RedisKeys.waitingList(QUEUE_NAME, 'normal'));
    expect(waitListLength).toBe(1);
    
    // Verify it is indeed the original job ID matching
    const jobsInQueue = await redisClient.lrange(RedisKeys.waitingList(QUEUE_NAME, 'normal'), 0, -1);
    expect(jobsInQueue).toEqual([job1Id]);
  });
});
