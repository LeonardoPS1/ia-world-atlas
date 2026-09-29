import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closePool, createPool } from '../src/db/pool.ts';
import { runMigrations } from '../src/db/migrate.ts';
import { runSeed } from '../src/db/seed.ts';
import type { ClientLike, PoolLike } from '../src/db/types.ts';

// This is the only test in the suite that executes SQL against a real server.
// Everything else in apps/api mocks PoolLike, which means no other test can ever
// catch a defect that lives in the SQL itself. That is not hypothetical: the GIN
// index on the search expression called array_to_string, which is STABLE and so
// cannot appear in an index expression, and the migration could not be applied at
// all. The suite was green the whole time.
//
// It skips when TEST_DATABASE_URL is unset so the default `npm test` stays
// hermetic, and it needs a server with PostGIS available, e.g.
//   docker compose up -d
//   TEST_DATABASE_URL=postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas npm test
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  console.warn('skipped: db integration (TEST_DATABASE_URL is not set)');
}

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));
const seedFile = fileURLToPath(new URL('../seeds/001_core_seed.sql', import.meta.url));

// Dropping these rather than the whole public schema keeps the PostGIS extension
// and its objects in place. Dropping public cascade would remove the geography
// type while pg_extension still lists postgis as installed, so the migration's
// `create extension if not exists` would skip and every geography column would
// then fail with "type geography does not exist".
const ATLAS_TABLES = [
  'events',
  'impact_records',
  'status_history',
  'project_sources',
  'relations',
  'projects',
  'sources',
  'locations',
  'schema_migrations',
];

const SEARCH_EXPRESSION = `to_tsvector(
  'spanish'::regconfig,
  coalesce(name, '') || ' ' || coalesce(summary, '') || ' ' || atlas_text_array_join(tags, ' ')
)`;

async function resetSchema(pool: PoolLike): Promise<void> {
  await pool.query(`drop table if exists ${ATLAS_TABLES.join(', ')} cascade`);
}

async function counts(pool: PoolLike): Promise<Record<string, number>> {
  const { rows } = await pool.query(`
    select
      (select count(*) from locations)::int as locations,
      (select count(*) from sources)::int as sources,
      (select count(*) from projects)::int as projects,
      (select count(*) from project_sources)::int as project_sources,
      (select count(*) from status_history)::int as status_history,
      (select count(*) from events)::int as events,
      (select count(*) from relations)::int as relations
  `);
  return rows[0] as Record<string, number>;
}

describe.skipIf(!testDatabaseUrl)('migration and seed against a real database', () => {
  let pool: PoolLike;

  beforeAll(async () => {
    pool = createPool(testDatabaseUrl as string);
    await resetSchema(pool);
  });

  afterAll(async () => {
    if (pool) await closePool(pool);
  });

  it('applies the real migration to a real server', async () => {
    await expect(runMigrations({ pool, migrationsDir })).resolves.toEqual(['001_core.sql']);
  });

  it('creates every table the seed then populates', async () => {
    await expect(runSeed({ pool, seedFile })).resolves.toBeUndefined();
    expect(await counts(pool)).toEqual({
      locations: 11,
      sources: 7,
      projects: 5,
      project_sources: 7,
      status_history: 8,
      events: 7,
      relations: 0,
    });
  });

  it('is idempotent: a second migration and seed change no rows', async () => {
    const first = await counts(pool);
    await expect(runMigrations({ pool, migrationsDir })).resolves.toEqual([]);
    await runSeed({ pool, seedFile });
    expect(await counts(pool)).toEqual(first);
  });

  it('realigns the serial sequences so a plain insert does not collide', async () => {
    // The seed inserts explicit ids into events and status_history, which are
    // bigserial. Without setval the sequence stays at 1 and the next insert
    // without an explicit id hits a duplicate key. Only a real sequence shows this.
    const { rows } = await pool.query(
      `insert into events (project_id, title, occurred_at, kind)
       select id, 'plain insert without an explicit id', '2026-01-01', 'TEST'
         from projects order by id limit 1
       returning id`,
    );
    const inserted = Number((rows[0] as { id: string }).id);
    expect(inserted).toBe(8);
  });

  it('builds a search index the planner will actually use', async () => {
    // On five rows the planner prefers a sequential scan, so an unforced EXPLAIN
    // proves nothing about the index. Pin one connection: enable_seqscan is a
    // session setting, and a pooled query would be free to land elsewhere.
    const client: ClientLike = await pool.connect();
    try {
      await client.query('set enable_seqscan = off');
      const { rows } = await client.query(
        `explain (costs off) select id from projects where ${SEARCH_EXPRESSION} @@ plainto_tsquery('spanish', 'inteligencia')`,
      );
      const plan = rows.map((row) => Object.values(row as Record<string, string>).join(' ')).join('\n');
      expect(plan).toContain('projects_search_idx');
    } finally {
      client.release();
    }
  });

  it('finds Spanish text through the index with stemming applied', async () => {
    const { rows } = await pool.query(
      `select id from projects where ${SEARCH_EXPRESSION} @@ plainto_tsquery('spanish', 'inteligencia')`,
    );
    expect(rows.map((row) => (row as { id: string }).id)).toEqual(['chile-national-ai-policy']);
  });
});
