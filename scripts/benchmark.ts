/**
 * Standalone benchmark script for the Distributed Task Queue.
 * Run with: npx tsx scripts/benchmark.ts
 *
 * Tests throughput, concurrency scaling, and end-to-end dispatch latency
 * against a real local Redis instance.
 */

// Silence verbose per-job logs during benchmark run
process.env.LOG_LEVEL = 'silent';

import Redis from 'ioredis';
import { overrideRedis } from '../src/lib/redis/client';
import { Queue } from '../src/queue/Queue';
import { WorkerPool } from '../src/worker/WorkerPool';

const QUEUE_NAME = 'benchmark_queue';

// ── Redis Setup ───────────────────────────────────────────────────────────────

const redis = new Redis({ host: '127.0.0.1', port: 6379, maxRetriesPerRequest: null });
overrideRedis(redis);

async function flushRedis(): Promise<void> {
  await redis.flushall();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function printTable(rows: { concurrency: number; jobsPerSec: number }[]): void {
  console.log('\n  Concurrency | Jobs/sec');
  console.log('  ------------|----------');
  for (const r of rows) {
    const conc = String(r.concurrency).padStart(10);
    const jps  = String(Math.round(r.jobsPerSec)).padStart(10);
    console.log(`  ${conc} | ${jps}`);
  }
  console.log();
}

// ── Scenario A: Throughput ────────────────────────────────────────────────────

async function runThroughput(concurrency: number, jobCount: number): Promise<number> {
  // Drain any leftover connections from previous scenario
  await new Promise(r => setTimeout(r, 300));
  await redis.flushall();

  const queue      = new Queue(QUEUE_NAME);
  const workerPool = new WorkerPool(QUEUE_NAME, concurrency);
  let completed    = 0;

  let resolveWhenDone!: (jps: number) => void;
  const done = new Promise<number>((res) => { resolveWhenDone = res; });

  workerPool.process('noop', async () => {
    completed++;
    if (completed === jobCount) {
      const elapsed = Date.now() - startTime;
      // Shutdown async, don't await inside handler to avoid deadlock
      workerPool.shutdown().then(() => resolveWhenDone((jobCount / elapsed) * 1000));
    }
  });

  const enqueueStart = Date.now();
  const enqueuePs: Promise<unknown>[] = [];
  for (let i = 0; i < jobCount; i++) {
    enqueuePs.push(queue.enqueue('noop', {}, 'normal', 1));
  }
  await Promise.all(enqueuePs);

  console.log(`  Enqueued ${jobCount} jobs in ${Date.now() - enqueueStart}ms. Processing...`);

  const startTime = Date.now();
  await workerPool.start();

  return done;
}

// ── Scenario C: Latency ───────────────────────────────────────────────────────

async function runLatency(jobCount = 100): Promise<{ p50: number; p95: number; p99: number }> {
  await new Promise(r => setTimeout(r, 300));
  await redis.flushall();

  const queue      = new Queue(QUEUE_NAME);
  const workerPool = new WorkerPool(QUEUE_NAME, 5);
  const latencies: number[] = [];

  workerPool.process('latency-probe', async (job) => {
    const enqueueTime = (job.data as { enqueueTime: number }).enqueueTime;
    latencies.push(Date.now() - enqueueTime);
  });

  await workerPool.start();

  // Enqueue jobs one at a time, capturing enqueueTime inside payload
  for (let i = 0; i < jobCount; i++) {
    await queue.enqueue('latency-probe', { enqueueTime: Date.now() }, 'normal', 1);
  }

  // Poll until all latencies collected (max 15s)
  const deadline = Date.now() + 15_000;
  while (latencies.length < jobCount && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }

  await workerPool.shutdown();

  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔥 Starting Distributed Task Queue Benchmark\n');

  // ── Scenario A ────────────────────────────────────────────────────────────
  console.log('━━━ Scenario A: Throughput (concurrency=10, 100 jobs) ━━━');
  const throughputA = await runThroughput(10, 100);
  console.log(`  Throughput: ${Math.round(throughputA).toLocaleString()} jobs/sec\n`);

  // ── Scenario B ────────────────────────────────────────────────────────────
  console.log('━━━ Scenario B: Concurrency Scaling (100 jobs each) ━━━');
  const scalingResults: { concurrency: number; jobsPerSec: number }[] = [];
  for (const concurrency of [1, 5, 10]) {
    process.stdout.write(`  Running concurrency=${concurrency}...`);
    const jps = await runThroughput(concurrency, 100);
    scalingResults.push({ concurrency, jobsPerSec: jps });
    console.log(` ${Math.round(jps).toLocaleString()} jobs/sec`);
  }
  printTable(scalingResults);

  // ── Scenario C ────────────────────────────────────────────────────────────
  console.log('━━━ Scenario C: Dispatch Latency (100 jobs, concurrency=5) ━━━');
  const latency = await runLatency(100);
  console.log(`  p50: ${latency.p50}ms`);
  console.log(`  p95: ${latency.p95}ms`);
  console.log(`  p99: ${latency.p99}ms\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  const peakThroughput = Math.max(...scalingResults.map((r) => r.jobsPerSec));
  console.log('═══════════════════════════════════════');
  console.log('         === BENCHMARK RESULTS ===      ');
  console.log('═══════════════════════════════════════');
  console.log(`  Peak Throughput:       ${Math.round(peakThroughput).toLocaleString()} jobs/sec (concurrency=10)`);
  console.log(`  p50 Dispatch Latency:  ${latency.p50}ms`);
  console.log(`  p95 Dispatch Latency:  ${latency.p95}ms`);
  console.log(`  p99 Dispatch Latency:  ${latency.p99}ms`);
  console.log('═══════════════════════════════════════\n');

  await redis.quit();
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  redis.quit().finally(() => process.exit(1));
});
