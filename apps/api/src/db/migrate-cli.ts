import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createPool, closePool } from './pool.ts';
import { runMigrations } from './migrate.ts';
import { loadEnv } from '../config/env.ts';

const env = loadEnv();
const pool = createPool(env.databaseUrl);
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

try {
  const applied = await runMigrations({ pool, migrationsDir, log: (m) => process.stdout.write(`${m}\n`) });
  process.stdout.write(`applied ${applied.length} migration(s)\n`);
} finally {
  await closePool(pool);
}
