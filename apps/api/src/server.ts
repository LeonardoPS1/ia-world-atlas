import 'dotenv/config';
import { buildApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createLogger } from './config/logger.ts';
import { createPool, closePool } from './db/pool.ts';
import { createPgRepositories } from './repositories/pg/index.ts';

const env = loadEnv();
const logger = createLogger(env.logLevel);
const pool = createPool(env.databaseUrl);

const app = buildApp({ repos: createPgRepositories(pool), env, logger });

const server = app.listen(env.port, () => {
  logger.info('atlas api listening', { port: env.port, env: env.nodeEnv });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('shutting down', { signal });
  server.close();
  await closePool(pool);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
