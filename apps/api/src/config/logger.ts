import type { AppEnv } from './env.ts';

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const ORDER: Record<AppEnv['logLevel'], number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(level: AppEnv['logLevel']): Logger {
  const threshold = ORDER[level];
  const emit =
    (severity: AppEnv['logLevel']) =>
    (message: string, meta?: Record<string, unknown>): void => {
      if (ORDER[severity] < threshold) return;
      const line = { severity, message, ...(meta ?? {}) };
      if (severity === 'error') process.stderr.write(`${JSON.stringify(line)}\n`);
      else process.stdout.write(`${JSON.stringify(line)}\n`);
    };
  return {
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
  };
}
