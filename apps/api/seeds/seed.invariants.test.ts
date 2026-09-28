import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const seed = await readFile(fileURLToPath(new URL('./001_core_seed.sql', import.meta.url)), 'utf8');
const migration = await readFile(
  fileURLToPath(new URL('../migrations/001_core.sql', import.meta.url)),
  'utf8',
);

const at = (haystack: string, needle: string, from = 0) =>
  haystack.toLowerCase().indexOf(needle.toLowerCase(), from);

/** The slice of the seed belonging to one `insert into <table> (...)` statement. */
function insertBlock(table: string): string {
  const start = at(seed, `insert into ${table} (`);
  if (start < 0) throw new Error(`no insert into ${table}`);
  const next = at(seed, 'insert into ', start + 1);
  return seed.slice(start, next < 0 ? seed.length : next);
}

/** Tables whose `id` column the migration declares serial rather than text. */
const SERIAL_ID_TABLES = [...migration.matchAll(/create table if not exists (\w+) \(([^;]*?)\n\);/g)]
  .filter(([, , body]) => /\bid\s+\w*serial\s+primary key/.test(body ?? ''))
  .map(([, name]) => name ?? '');

describe('seed file invariants', () => {
  it('never assigns VERIFIED evidence', () => {
    expect(seed).not.toMatch(/'VERIFIED'/);
  });

  it('creates no relations', () => {
    expect(seed).not.toMatch(/insert into relations/i);
  });

  it('inserts exactly eleven locations', () => {
    const block = insertBlock('locations');
    expect((block.match(/\('([a-z0-9-]+)',/g) ?? []).length).toBe(11);
  });

  it('references only https sources', () => {
    const urls = [...seed.matchAll(/'(https?:\/\/[^']+)'/g)].map((m) => m[1] ?? '');
    expect(urls.length).toBeGreaterThanOrEqual(5);
    for (const url of urls) expect(url.startsWith('https://')).toBe(true);
  });

  it('uses the six location levels', () => {
    for (const level of ['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']) {
      expect(seed).toContain(`'${level}'`);
    }
  });

  it('carries no CJK or replacement characters', () => {
    const damaged = [...seed].filter((ch) => /[\u3000-\u9FFF\uFFFD]/.test(ch));
    expect(damaged).toEqual([]);
  });
});

describe('seed idempotency', () => {
  // Each table is checked in its own slice. A single whole-file check matches
  // whichever table happens to come first, so deleting the events insert
  // entirely would still report the seed clean. And the conflict target is not
  // uniform: project_sources is a join table with a composite primary key and
  // no id column at all, so asserting (id) everywhere would be simply wrong.
  const CONFLICT_TARGETS: Record<string, string> = {
    locations: 'id',
    sources: 'id',
    projects: 'id',
    project_sources: 'project_id, source_id',
    events: 'id',
    status_history: 'id',
  };

  for (const [table, target] of Object.entries(CONFLICT_TARGETS)) {
    it(`upserts ${table} on its own conflict target (${target})`, () => {
      expect(insertBlock(table)).toContain(`on conflict (${target}) do update set`);
    });
  }
});

describe('id sequences', () => {
  it('found the serial id tables it depends on', () => {
    // Guards the test below: if this regex ever stops matching, the realignment
    // check would pass vacuously over an empty set. impact_records is serial but
    // the seed never sets its id, so it correctly needs no realignment.
    expect(SERIAL_ID_TABLES).toEqual(['status_history', 'impact_records', 'events']);
  });

  it('realigns the sequence of every serial id table it sets explicitly', () => {
    const explicitIdTables = [...seed.matchAll(/insert into (\w+) \(\s*id,/g)].map((m) => m[1] ?? '');
    const needingRealignment = SERIAL_ID_TABLES.filter((table) => explicitIdTables.includes(table));
    expect(needingRealignment.length).toBeGreaterThan(0);
    for (const table of needingRealignment) {
      expect(seed, `${table} gets explicit ids but its sequence is never realigned`).toContain(
        `pg_get_serial_sequence('${table}', 'id')`,
      );
    }
  });
});
