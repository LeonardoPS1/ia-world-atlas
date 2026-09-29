import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoolLike } from './types.ts';

export const MIGRATIONS_TABLE = 'schema_migrations';

const CREATE_MIGRATIONS_TABLE = `
create table if not exists ${MIGRATIONS_TABLE} (
  name text primary key,
  applied_at timestamptz not null default now()
)`;

const SELECT_APPLIED = `select name from ${MIGRATIONS_TABLE}`;

export interface RunMigrationsOptions {
  pool: PoolLike;
  migrationsDir: string;
  log?: (message: string) => void;
}

// Exported so the ordering claim is testable without a filesystem. NTFS returns
// readdir results in name order, so asserting that the files come back sorted
// proves nothing: an implementation that never called .sort() would pass on
// every machine this plan is likely to run on. Feeding this function a
// deliberately shuffled array is the only version of the test that fails when
// the sort is removed.
export function sortMigrationFiles(names: string[]): string[] {
  return names.filter((name) => name.endsWith('.sql')).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export async function runMigrations(options: RunMigrationsOptions): Promise<string[]> {
  const { pool, migrationsDir, log = () => {} } = options;
  const files = sortMigrationFiles(await readdir(migrationsDir));

  if (files.length === 0) {
    throw new Error(`no .sql migrations found in ${migrationsDir}`);
  }

  await pool.query(CREATE_MIGRATIONS_TABLE);
  const appliedResult = await pool.query(SELECT_APPLIED);
  const alreadyApplied = new Set(appliedResult.rows.map((row) => (row as { name: string }).name));

  const applied: string[] = [];
  for (const file of files) {
    if (alreadyApplied.has(file)) {
      log(`skip ${file} (already applied)`);
      continue;
    }
    const client = await pool.connect();
    try {
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `insert into ${MIGRATIONS_TABLE} (name) values ($1) on conflict do nothing`,
        [file],
      );
      await client.query('COMMIT');
      applied.push(file);
      log(`applied ${file}`);
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Best effort. A rollback that cannot be sent (pool exhausted, connection
        // already aborted) must not replace the migration error, which is the one
        // that tells the operator what actually went wrong.
      }
      throw new Error(`migration ${file} failed: ${(error as Error).message}`, { cause: error });
    } finally {
      try {
        client.release();
      } catch {
        // Best effort, same reasoning as ROLLBACK above: a throw from a finally
        // block replaces the pending exception, and pg-pool's release() throws
        // synchronously on a double release. Losing the migration error to a
        // pool bookkeeping error is the worst possible outcome.
      }
    }
  }
  return applied;
}
