import { Redis } from 'ioredis';
import { config } from '../../config';
import { createLogger } from '../logger';

const log = createLogger('Redis');

// ── Singleton instance ───────────────────────────────────────────────────────

let _instance: Redis | null = null;

/**
 * Returns the shared (non-blocking) Redis client.
 * Lazily initialized on first call so env vars / overrideRedis can be set first.
 */
export function getRedis(): Redis {
  if (!_instance) {
    _instance = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    _instance.on('connect', () => log.info('Connected', { host: config.redis.host, port: config.redis.port }));
    _instance.on('error', (err) => log.error('Connection error', { error: String(err) }));
  }
  return _instance;
}

/**
 * Proxy object so existing `import { redis }` style still works
 * while deferring actual connection until first use.
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(target, prop, receiver) {
    const client = getRedis();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

/**
 * Creates a dedicated Redis connection for blocking commands (BRPOP).
 * Each worker needs its own connection because BRPOP blocks the socket.
 */
export function createBlockingClient(): Redis {
  return getRedis().duplicate();
}

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Inject a test-provided Redis instance (call before any getRedis()). */
export function overrideRedis(client: Redis): void {
  _instance = client;
}

/** Disconnect and clear the singleton. */
export async function resetRedis(): Promise<void> {
  if (_instance) {
    try { await _instance.quit(); } catch { /* already closed */ }
    _instance = null;
  }
}
