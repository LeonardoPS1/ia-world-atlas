import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { MIGRATIONS_TABLE, runMigrations, sortMigrationFiles } from './migrate.ts';
import type { ClientLike, PoolLike, QueryResultLike } from './types.ts';

const migrationsDir = fileURLToPath(new URL('./__fixtures__/migrations', import.meta.url));

type Call = { sql: string; values?: unknown[]; via: 'pool' | 'client' };

function fakePool(applied: string[], failOn?: RegExp) {
  const calls: Call[] = [];
  let released = 0;

  const answer = async (sql: string): Promise<QueryResultLike> => {
    if (sql.includes(`select name from ${MIGRATIONS_TABLE}`)) {
      return { rows: applied.map((name) => ({ name })), rowCount: applied.length };
    }
    if (failOn?.test(sql)) throw new Error('syntax error at or near "SELCT"');
    return { rows: [], rowCount: 0 };
  };

  const pool: PoolLike = {
    async query(sql, values) {
      calls.push({ sql, values, via: 'pool' });
      return answer(sql);
    },
    async connect(): Promise<ClientLike> {
      return {
        async query(sql, values) {
          calls.push({ sql, values, via: 'client' });
          return answer(sql);
        },
        release() {
          released += 1;
        },
      };
    },
    async end() {
      return undefined;
    },
  };

  const sqlOf = (via?: Call['via']) =>
    calls.filter((c) => via === undefined || c.via === via).map((c) => c.sql);

  return { pool, calls, sqlOf, releasedCount: () => released };
}

const PENDING = ['001_core.sql', '002_aaa.sql', '003_zzz.sql'];

describe('runMigrations', () => {
  it('applies every pending file exactly once', async () => {
    const { pool, sqlOf } = fakePool([]);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual(PENDING);
    expect(sqlOf()).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`create table if not exists ${MIGRATIONS_TABLE}`),
      ]),
    );
  });

  it('orders migrations by name regardless of the order the filesystem reports them', () => {
    const shuffled = ['003_zzz.sql', '001_core.sql', 'README.md', '002_aaa.sql'];
    expect(sortMigrationFiles(shuffled)).toEqual(PENDING);
  });

  it('records the migration file name in the bookkeeping table', async () => {
    const { pool, calls } = fakePool([]);
    await runMigrations({ pool, migrationsDir });
    const inserts = calls.filter((c) => c.sql.includes(`insert into ${MIGRATIONS_TABLE}`));
    expect(inserts.map((c) => c.values?.[0])).toEqual(PENDING);
  });

  it('runs BEGIN, the body and the bookkeeping insert on one checked-out client', async () => {
    const { pool, sqlOf, releasedCount } = fakePool([]);
    await runMigrations({ pool, migrationsDir });
    // The migration body, the insert and the control statements must all travel on a
    // single connection. Transaction state is per connection, so a BEGIN issued through
    // pool#query can land somewhere else entirely and commit nothing.
    expect(sqlOf('client')).toEqual([
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
      'BEGIN',
      expect.stringContaining('fixture'),
      expect.stringContaining(`insert into ${MIGRATIONS_TABLE}`),
      'COMMIT',
    ]);
    expect(releasedCount()).toBe(3);
  });

  it('skips migrations already recorded', async () => {
    const { pool, sqlOf } = fakePool(PENDING);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual([]);
    expect(sqlOf()).not.toContain('BEGIN');
  });

  it('skips only the recorded ones and still applies the rest', async () => {
    const { pool, sqlOf } = fakePool(['002_aaa.sql']);
    const applied = await runMigrations({ pool, migrationsDir });
    expect(applied).toEqual(['001_core.sql', '003_zzz.sql']);
    expect(sqlOf('client').filter((s) => s === 'BEGIN')).toHaveLength(2);
  });

  it('rolls back and rethrows when a migration fails', async () => {
    const { pool, sqlOf, releasedCount } = fakePool([], /fixture/);
    await expect(runMigrations({ pool, migrationsDir })).rejects.toThrow(/SELCT/);
    expect(sqlOf('client')).toContain('ROLLBACK');
    expect(sqlOf('client')).not.toContain('COMMIT');
    expect(releasedCount()).toBe(1);
  });

  it('keeps the migration error when the rollback itself fails', async () => {
    const { pool } = fakePool([], /fixture/);
    const failing: PoolLike = {
      ...pool,
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          async query(sql, values) {
            if (sql === 'ROLLBACK') throw new Error('connection terminated');
            return client.query(sql, values);
          },
        };
      },
    };
    await expect(runMigrations({ pool: failing, migrationsDir })).rejects.toThrow(
      /^migration 001_core\.sql failed: syntax error at or near "SELCT"/,
    );
  });

  it('keeps the migration error when releasing the client also fails', async () => {
    const { pool } = fakePool([], /fixture/);
    const doubleReleasing: PoolLike = {
      ...pool,
      async connect() {
        const client = await pool.connect();
        return {
          ...client,
          release() {
            throw new Error('Release called on client which has already been released to the pool.');
          },
        };
      },
    };
    const error = await runMigrations({ pool: doubleReleasing, migrationsDir }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error?.message).toMatch(/^migration 001_core\.sql failed: syntax error at or near "SELCT"/);
    expect((error?.cause as Error | undefined)?.message).toBe('syntax error at or near "SELCT"');
  });

  it('preserves the original error as the cause of the migration failure', async () => {
    const { pool } = fakePool([], /fixture/);
    const error = await runMigrations({ pool, migrationsDir }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error?.cause).toBeInstanceOf(Error);
    expect((error?.cause as Error).message).toBe('syntax error at or near "SELCT"');
  });

  it('refuses to run against a directory with no migrations', async () => {
    const { pool, sqlOf } = fakePool([]);
    await expect(
      runMigrations({
        pool,
        migrationsDir: fileURLToPath(new URL('./__fixtures__/empty', import.meta.url)),
      }),
    ).rejects.toThrow(/no \.sql migrations found/);
    expect(sqlOf()).not.toContain('BEGIN');
  });
});
