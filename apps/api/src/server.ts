import 'dotenv/config';
import { buildApp } from './app.ts';
import { loadEnv } from './config/env.ts';
import { createLogger } from './config/logger.ts';
import { createPool, closePool } from './db/pool.ts';
import { createPgRepositories } from './repositories/pg/index.ts';
import { createFakeRepositories } from './repositories/fake.ts';
import { atlasDataFixture } from './testing/fixtures.ts';
import type { AtlasRepositories } from './repositories/types.ts';

const env = loadEnv();
const logger = createLogger(env.logLevel);
const useMemory = process.env['ATLAS_REPOS'] === 'memory';

const pool = useMemory ? null : createPool(env.databaseUrl);
const repos: AtlasRepositories = useMemory
  ? createFakeRepositories(atlasDataFixture)
  : createPgRepositories(pool!);

const app = buildApp({ repos, env, logger });

const server = app.listen(env.port, () => {
  logger.info('atlas api listening', { port: env.port, env: env.nodeEnv, repos: useMemory ? 'memory' : 'postgres' });
});

async function shutdown(signal: string): Promise<void> {
  logger.info('shutting down', { signal });
  server.close();
  if (pool) await closePool(pool);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
