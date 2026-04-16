/**
 * Redis key builders for the distri-sdk.
 * Matches the core system's key patterns.
 */

export const RedisKeys = {
  /** job:<id> — Hash holding full job metadata */
  jobHash: (id: string): string => `job:${id}`,

  /** queue:<name>:waiting:<priority> — List of job IDs awaiting processing */
  waitingList: (queue: string, priority: string): string =>
    `queue:${queue}:waiting:${priority}`,

  /** queue:<name>:delayed — Sorted set scored by due-timestamp */
  delayedSet: (queue: string): string => `queue:${queue}:delayed`,

  /** queue:<name>:dead — List of dead-letter job IDs */
  deadList: (queue: string): string => `queue:${queue}:dead`,
} as const;
