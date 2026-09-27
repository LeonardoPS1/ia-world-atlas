import pg from 'pg';
import type { PoolLike } from './types.js';

export function createPool(connectionString: string): PoolLike {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'ai-world-atlas-api',
  });
  return pool as unknown as PoolLike;
}

export async function closePool(pool: PoolLike): Promise<void> {
  await pool.end();
}
