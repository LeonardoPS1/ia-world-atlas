import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PoolLike } from './types.js';

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

export async function runMigrations(options: RunMigrationsOptions): Promise<string[]> {
  const { pool, migrationsDir, log = () => {} } = options;
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

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
      client.release();
    }
  }
  return applied;
}
