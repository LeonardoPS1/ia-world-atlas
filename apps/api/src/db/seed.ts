import { readFile } from 'node:fs/promises';
import type { PoolLike } from './types.js';

export interface RunSeedOptions {
  pool: PoolLike;
  seedFile: string;
  log?: (message: string) => void;
}

export async function runSeed(options: RunSeedOptions): Promise<void> {
  const { pool, seedFile, log = () => {} } = options;
  const sql = await readFile(seedFile, 'utf8');
  log(`seeding ${seedFile}`);

  // One checked-out client for the whole transaction. Transaction state lives on
  // the connection, so issuing BEGIN through pool#query and the body through a
  // second checkout can put them on different connections, which leaves the seed
  // running in autocommit and COMMIT with nothing to commit.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    log('seed applied');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Best effort. A rollback that cannot be sent must not replace the seed
      // error, which is the one that tells the operator what actually went wrong.
    }
    throw new Error(`seed failed: ${(error as Error).message}`, { cause: error });
  } finally {
    try {
      client.release();
    } catch {
      // Best effort, same reasoning as ROLLBACK above: a throw from a finally
      // block replaces the pending exception, and pg-pool's release() throws
      // synchronously on a double release.
    }
  }
}
