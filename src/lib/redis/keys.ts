/**
 * Redis key builders — single source of truth for every key pattern.
 *
 * Keeps key logic out of business code and makes refactoring key
 * schemas a one-file change.
 */

export const RedisKeys = {
  /** job:<id> — Hash holding full job metadata */
  jobHash: (id: string): string => `job:${id}`,

  /** queue:<name>:waiting:<priority> — List of job IDs awaiting processing */
  waitingList: (queue: string, priority: string): string =>
    `queue:${queue}:waiting:${priority}`,

  /** queue:<name>:processing — List of jobs actively being handled by workers */
  processingList: (queue: string): string => `queue:${queue}:processing`,

  /** queue:<name>:delayed — Sorted set scored by due-timestamp */
  delayedSet: (queue: string): string => `queue:${queue}:delayed`,

  /** queue:<name>:dead — List of dead-letter job IDs */
  deadList: (queue: string): string => `queue:${queue}:dead`,

  /** active_jobs:<queue> — Hash mapping jobId → ActiveJobEntry JSON */
  activeJobsHash: (queue: string): string => `active_jobs:${queue}`,

  /** heartbeat:<id> — String key with TTL, renewed periodically */
  heartbeat: (id: string): string => `heartbeat:${id}`,

  // ── Metric keys ──────────────────────────────────────────────────
  jobsProcessedTotal: 'jobs_processed_total' as const,
  jobsFailedTotal:    'jobs_failed_total'    as const,
  processingTimeSum:  'processing_time_sum_ms' as const,
} as const;
