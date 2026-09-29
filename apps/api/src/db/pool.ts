import pg from 'pg';
import type { PoolLike } from './types.ts';

export function createPool(connectionString: string): PoolLike {
  return new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'ai-world-atlas-api',
  });
}

export async function closePool(pool: PoolLike): Promise<void> {
  await pool.end();
}
