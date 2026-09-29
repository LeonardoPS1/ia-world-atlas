import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { runSeed } from './seed.ts';
import type { ClientLike, PoolLike, QueryResultLike } from './types.ts';

const seedFile = fileURLToPath(new URL('./__fixtures__/seed/001_core_seed.sql', import.meta.url));

type Call = { sql: string; via: 'pool' | 'client' };

function fakePool(failOn?: RegExp) {
  const calls: Call[] = [];
  let released = 0;

  const answer = async (sql: string): Promise<QueryResultLike> => {
    if (failOn?.test(sql)) throw new Error('duplicate key violates unique constraint');
    return { rows: [], rowCount: 0 };
  };

  const pool: PoolLike = {
    async query(sql) {
      calls.push({ sql, via: 'pool' });
      return answer(sql);
    },
    async connect(): Promise<ClientLike> {
      return {
        async query(sql) {
          calls.push({ sql, via: 'client' });
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

describe('runSeed', () => {
  it('wraps the seed file in a single transaction', async () => {
    const { pool, sqlOf } = fakePool();
    await runSeed({ pool, seedFile });
    // BEGIN, the body and COMMIT must all travel on one checked-out connection.
    // Transaction state is per connection, so a BEGIN issued through pool#query can
    // land on a different connection than the body and commit nothing at all.
    expect(sqlOf('client')).toEqual([
      'BEGIN',
      expect.stringContaining('dummy_seed_probe'),
      'COMMIT',
    ]);
  });

  it('reports the file it applied and then that it succeeded', async () => {
    const { pool } = fakePool();
    const messages: string[] = [];
    await runSeed({ pool, seedFile, log: (m) => messages.push(m) });
    expect(messages).toEqual([`seeding ${seedFile}`, 'seed applied']);
  });

  it('releases the client after a successful seed', async () => {
    const { pool, releasedCount } = fakePool();
    await runSeed({ pool, seedFile });
    expect(releasedCount()).toBe(1);
  });

  it('rolls back and rethrows when the seed fails', async () => {
    const { pool, sqlOf, releasedCount } = fakePool(/dummy_seed_probe/);
    await expect(runSeed({ pool, seedFile })).rejects.toThrow(/duplicate key/);
    expect(sqlOf('client')).toContain('ROLLBACK');
    expect(sqlOf('client')).not.toContain('COMMIT');
    expect(releasedCount()).toBe(1);
  });

  it('keeps the seed error when the rollback itself fails', async () => {
    const { pool } = fakePool(/dummy_seed_probe/);
    const failingRollback: PoolLike = {
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
    await expect(runSeed({ pool: failingRollback, seedFile })).rejects.toThrow(
      /^seed failed: duplicate key violates unique constraint/,
    );
  });

  it('keeps the seed error when releasing the client also fails', async () => {
    const { pool } = fakePool(/dummy_seed_probe/);
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
    const error = await runSeed({ pool: doubleReleasing, seedFile }).then(
      () => null,
      (caught: unknown) => caught as Error,
    );
    expect(error?.message).toMatch(/^seed failed: duplicate key violates unique constraint/);
    expect((error?.cause as Error | undefined)?.message).toBe(
      'duplicate key violates unique constraint',
    );
  });
});
