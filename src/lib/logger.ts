/**
 * Structured JSON logger.
 *
 * Outputs one JSON object per line so logs are machine-parseable
 * and easily ingested by tools like Loki, Datadog, or ELK.
 *
 * Usage:
 *   const log = createLogger('WorkerPool');
 *   log.info('Started', { concurrency: 5 });
 *   // → {"ts":"...","level":"info","component":"WorkerPool","msg":"Started","concurrency":5}
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  component: string;
  msg: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

function emit(level: LogLevel, component: string, msg: string, ctx?: Record<string, unknown>): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    component,
    msg,
    ...ctx,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case 'error':
      process.stderr.write(line + '\n');
      break;
    case 'warn':
      process.stderr.write(line + '\n');
      break;
    default:
      process.stdout.write(line + '\n');
  }
}

/**
 * Creates a logger instance bound to a specific component name.
 */
export function createLogger(component: string): Logger {
  return {
    debug: (msg, ctx?) => emit('debug', component, msg, ctx),
    info:  (msg, ctx?) => emit('info',  component, msg, ctx),
    warn:  (msg, ctx?) => emit('warn',  component, msg, ctx),
    error: (msg, ctx?) => emit('error', component, msg, ctx),
  };
}
