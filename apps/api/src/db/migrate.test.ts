import { describe, expect, it } from 'vitest';
import { MIGRATIONS_TABLE, runMigrations } from './migrate.js';
import type { PoolLike, QueryResultLike } from './types.js';

function fakePool(applied: string[]) {
  const executed: string[] = [];
  const pool: PoolLike = {
    async query(sql: string): Promise<QueryResultLike> {
      if (sql.includes(`select name from ${MIGRATIONS_TABLE}`)) {
        return { rows: applied.map((name) => ({ name })), rowCount: applied.length };
      }
      // Bookkeeping, not part of the transaction under test: runMigrations creates
      // schema_migrations before the loop opens BEGIN, so recording it here would
      // make `executed[0]` 'SQL' instead of 'BEGIN'.
      if (sql.includes(`create table if not exists ${MIGRATIONS_TABLE}`)) {
        return { rows: [], rowCount: 0 };
      }
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
        executed.push(sql);
        return { rows: [], rowCount: 0 };
      }
      executed.push('SQL');
      return { rows: [], rowCount: 0 };
    },
    async end() {
      return undefined;
    },
  };
  return { pool, executed };
}

const migrationsDir = new URL('./__fixtures__/migrations', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

describe('runMigrations', () => {
  it('applies pending files in lexicographic order inside a transaction', async () => {
    const { pool, executed } = fakePool([]);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual(['001_core.sql', '002_upgrade_v4.sql']);
    expect(executed[0]).toBe('BEGIN');
    expect(executed[executed.length - 1]).toBe('COMMIT');
  });

  it('skips migrations already recorded', async () => {
    const { pool, executed } = fakePool(['001_core.sql', '002_upgrade_v4.sql']);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual([]);
    expect(executed).not.toContain('BEGIN');
  });

  it('rolls back and rethrows when a migration fails', async () => {
    const seen: string[] = [];
    const pool: PoolLike = {
      async query(sql: string): Promise<QueryResultLike> {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          seen.push(sql);
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes(`select name from ${MIGRATIONS_TABLE}`)) return { rows: [], rowCount: 0 };
        // Same bookkeeping as fakePool: without this the throw fires on
        // CREATE_MIGRATIONS_TABLE, which runs before the loop opens BEGIN, so the
        // test would pass without ever opening or rolling back a transaction.
        if (sql.includes(`create table if not exists ${MIGRATIONS_TABLE}`)) {
          return { rows: [], rowCount: 0 };
        }
        throw new Error('syntax error at or near "SELCT"');
      },
      async end() {
        return undefined;
      },
    };
    await expect(runMigrations({ pool, migrationsDir })).rejects.toThrow(/SELCT/);
    expect(seen).toContain('ROLLBACK');
    expect(seen).not.toContain('COMMIT');
  });
});
