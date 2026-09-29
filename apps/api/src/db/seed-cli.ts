import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createPool, closePool } from './pool.ts';
import { runSeed } from './seed.ts';
import { loadEnv } from '../config/env.ts';

const env = loadEnv();
const pool = createPool(env.databaseUrl);
const seedFile = fileURLToPath(new URL('../../seeds/001_core_seed.sql', import.meta.url));

try {
  await runSeed({ pool, seedFile, log: (m) => process.stdout.write(`${m}\n`) });
} finally {
  await closePool(pool);
}
