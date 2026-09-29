import { describe, expect, it } from 'vitest';
import type { ProjectSummary } from '@atlas/contracts';
import { matchesProjectFilters, paginate, searchTokensMatch, sortProjects } from './filters.ts';

const base: ProjectSummary = {
  id: 'chile-national-ai-policy',
  name: 'Politica Nacional de Inteligencia Artificial',
  type: 'POLICY',
  status: 'ACTIVE',
  evidence: 'REPORTED',
  sector: 'Policy',
  summary: 'Politica vigente desde 2021 con plan de accion.',
  year: 2021,
  locationId: 'chile',
  longitude: -71.5,
  latitude: -35.7,
  actors: ['Ministerio de Ciencia'],
  tags: ['national policy'],
  publishedAt: '2023-01-01T00:00:00.000Z',
  lastVerifiedAt: '2026-09-25T00:00:00.000Z',
  sourceCount: 2,
  eventCount: 2,
};

// `other` sorts BEFORE `base` by name ('European' precedes 'Politica') but carries
// the EARLIER date, so the two sort modes disagree. Two further traps are being
// closed here. Spreading `base` copies base's publishedAt, and two equal dates
// never reach the descending branch at all: the sort falls through to the name
// tiebreaker, so a test named "orders by publication date descending" would
// assert the tiebreaker instead while appearing to cover the date. And if the
// fixtures also happened to agree under both orders, swapping the two assertions
// would leave the test green, which is the same blind spot as the accent tests.
const other: ProjectSummary = {
  ...base,
  id: 'eu-ai-factories',
  type: 'INFRASTRUCTURE',
  name: 'European AI Factories',
  tags: ['compute'],
  publishedAt: '2020-05-01T00:00:00.000Z',
};

describe('project filters', () => {
  it('ORs values inside one parameter and ANDs across parameters', () => {
    expect(
      matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY', 'RESEARCH'] }),
    ).toBe(true);
    expect(
      matchesProjectFilters(other, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY', 'RESEARCH'] }),
    ).toBe(false);
    expect(
      matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', type: ['POLICY'], status: ['DEPLOYING'] }),
    ).toBe(false);
  });

  it('folds accents so an unaccented query still finds accented text', () => {
    // The `base` fixture above is deliberately unaccented, so it cannot catch a
    // broken fold: deleting `.normalize('NFD').replace(/[\u0300-\u036f]/g, '')`
    // from filters.ts would leave every other test in this file green. The
    // accented copy is what makes the folding observable, in both directions.
    const accented: ProjectSummary = {
      ...base,
      name: 'Política Nacional de Inteligencia Artificial',
      summary: 'Política vigente desde 2021 con plan de acción.',
      sector: 'Políticas Públicas',
    };
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'politica' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'política' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'inteligencia' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'accion' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', q: 'ausente' }),
    ).toBe(false);
  });

  it('compares the sector filter with the same accent folding', () => {
    const accented: ProjectSummary = { ...base, sector: 'Políticas Públicas' };
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'politicas publicas' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'Políticas Públicas' }),
    ).toBe(true);
    expect(
      matchesProjectFilters(accented, { page: 1, pageSize: 50, sort: 'name', sector: 'salud' }),
    ).toBe(false);
  });

  it('matches plain unaccented search text', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'politica' })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'artificial' })).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', q: 'ausente' })).toBe(false);
  });

  it('filters by year range inclusive', () => {
    expect(
      matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearFrom: 2021, yearTo: 2021 }),
    ).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearFrom: 2022 })).toBe(false);
    // The upper bound has its own branch, so it needs its own assertion. Without
    // this, deleting the whole `yearTo` check leaves the range test green.
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearTo: 2020 })).toBe(false);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', yearTo: 2021 })).toBe(true);
  });

  it('filters by location id', () => {
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['chile'] })).toBe(true);
    expect(
      matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['chile', 'peru'] }),
    ).toBe(true);
    expect(matchesProjectFilters(base, { page: 1, pageSize: 50, sort: 'name', locationIds: ['peru'] })).toBe(false);
  });

  it('searches tags as well as name, summary, sector and location', () => {
    // 'criptografia' appears in the tag array and nowhere else on the record, so
    // dropping `...project.tags` from the haystack cannot go unnoticed.
    const tagged: ProjectSummary = { ...base, tags: ['criptografia'] };
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'criptografia' })).toBe(true);
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'cripto' })).toBe(true);
    expect(matchesProjectFilters(tagged, { page: 1, pageSize: 50, sort: 'name', q: 'criptografiaq' })).toBe(false);
  });

  it('ignores stopwords so an all-article query does not filter everything out', () => {
    // A search box full of articles has to return the full result set, not none
    // of it. Without this, the STOPWORDS set could be deleted and every search
    // for "de" or "la" would silently return zero rows.
    expect(searchTokensMatch('anything at all', 'de la')).toBe(true);
    expect(searchTokensMatch('politica nacional', 'de los')).toBe(true);
    // In a mixed query only the meaningful token has to match.
    expect(searchTokensMatch('politica nacional', 'de inteligencia')).toBe(false);
    expect(searchTokensMatch('politica nacional', 'de politica')).toBe(true);
  });

  it('orders by name and by publication date descending', () => {
    const list = [other, base];
    // The two orders are deliberately opposite, so each assertion can only pass
    // if that sort actually did its own job.
    expect(sortProjects(list, 'name').map((p) => p.id)).toEqual([
      'eu-ai-factories',
      'chile-national-ai-policy',
    ]);
    expect(sortProjects(list, 'publishedAt').map((p) => p.id)).toEqual([
      'chile-national-ai-policy',
      'eu-ai-factories',
    ]);
  });

  // The tiebreaker is the behaviour the previous version of this test was
  // accidentally measuring. Undated projects sort last and break ties by name.
  it('sorts undated projects last and breaks ties by name', () => {
    const undatedB: ProjectSummary = { ...base, id: 'zzz-undated', name: 'Zeta', publishedAt: null };
    const undatedA: ProjectSummary = { ...base, id: 'aaa-undated', name: 'Alpha', publishedAt: null };
    const list = [undatedB, undatedA, other];
    expect(sortProjects(list, 'publishedAt').map((p) => p.id)).toEqual([
      'eu-ai-factories',
      'aaa-undated',
      'zzz-undated',
    ]);
  });

  it('paginates with a stable total and totalPages', () => {
    const page = paginate([1, 2, 3, 4, 5], 2, 2);
    expect(page.data).toEqual([3, 4]);
    expect(page.total).toBe(5);
    expect(page.totalPages).toBe(3);
  });

  it('requires every token to appear, so short tokens still work', () => {
    expect(searchTokensMatch('人工智能 policy', 'poli')).toBe(true);
    expect(searchTokensMatch('人工智能 policy', 'zzz')).toBe(false);
  });
});
