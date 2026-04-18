/**
 * Centralized, typed configuration for the distributed task queue.
 * All magic numbers live here. Override via environment variables.
 */

export interface QueueConfig {
  readonly redis: {
    readonly url?: string;
    readonly host: string;
    readonly port: number;
  };
  readonly queue: {
    readonly name: string;
  };
  readonly worker: {
    readonly concurrency: number;
    readonly heartbeatIntervalMs: number;
    readonly heartbeatTtlSec: number;
  };
  readonly watchdog: {
    readonly intervalMs: number;
  };
  readonly scheduler: {
    readonly intervalMs: number;
  };
  readonly backoff: {
    readonly maxDelayMs: number;
    readonly jitterMs: number;
  };
  readonly api: {
    readonly port: number;
    readonly host: string;
  };
}

function loadConfig(): QueueConfig {
  return Object.freeze({
    redis: Object.freeze({
      url: process.env.REDIS_URL,
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
    }),
    queue: Object.freeze({
      name: process.env.QUEUE_NAME || 'main_queue',
    }),
    worker: Object.freeze({
      concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
      heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS) || 5_000,
      heartbeatTtlSec: Number(process.env.HEARTBEAT_TTL_SEC) || 15,
    }),
    watchdog: Object.freeze({
      intervalMs: Number(process.env.WATCHDOG_INTERVAL_MS) || 10_000,
    }),
    scheduler: Object.freeze({
      intervalMs: Number(process.env.SCHEDULER_INTERVAL_MS) || 500,
    }),
    backoff: Object.freeze({
      maxDelayMs: Number(process.env.BACKOFF_MAX_DELAY_MS) || 30_000,
      jitterMs: Number(process.env.BACKOFF_JITTER_MS) || 200,
    }),
    api: Object.freeze({
      port: Number(process.env.PORT || process.env.API_PORT) || 3000,
      host: process.env.API_HOST || '0.0.0.0',
    }),
  });
}

export const config = loadConfig();
