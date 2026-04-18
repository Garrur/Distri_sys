import { Redis } from 'ioredis';
import fs from 'fs';
import path from 'path';
import { config } from '../../config';
import { createLogger } from '../logger';

declare module 'ioredis' {
  interface Redis {
    idempotentEnqueue(idempotencyKey: string, waitingListKey: string, jobId: string, ttl: string): Promise<string>;
  }
}

const log = createLogger('Redis');

function attachCommands(client: Redis): Redis {
  const scriptPath = path.join(__dirname, 'scripts', 'idempotentEnqueue.lua');
  const luaScript = fs.readFileSync(scriptPath, 'utf8');
  client.defineCommand('idempotentEnqueue', {
    numberOfKeys: 2,
    lua: luaScript,
  });
  return client;
}

// ── Singleton instance ───────────────────────────────────────────────────────

let _instance: Redis | null = null;

/**
 * Returns the shared (non-blocking) Redis client.
 * Lazily initialized on first call so env vars / overrideRedis can be set first.
 */
export function getRedis(): Redis {
  if (!_instance) {
    if (config.redis.url) {
      _instance = new Redis(config.redis.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      _instance.on('connect', () => log.info('Connected to Redis Cloud via URL'));
    } else {
      _instance = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });
      _instance.on('connect', () => log.info('Connected', { host: config.redis.host, port: config.redis.port }));
    }
    _instance.on('error', (err) => log.error('Connection error', { error: String(err) }));
    attachCommands(_instance);
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
  _instance = attachCommands(client);
}

/** Disconnect and clear the singleton. */
export async function resetRedis(): Promise<void> {
  if (_instance) {
    try { await _instance.quit(); } catch { /* already closed */ }
    _instance = null;
  }
}
