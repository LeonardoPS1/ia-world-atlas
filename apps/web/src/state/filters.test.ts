import { describe, expect, it } from 'vitest';
import { activeFilterCount, isFilterActive, toQuery, toggleInList } from './filters.ts';
import type { AtlasFilters } from './filters.ts';

const empty: AtlasFilters = {
  q: '',
  type: [],
  status: [],
  evidence: [],
  yearFrom: null,
  yearTo: null,
  locationId: null,
  sort: 'publishedAt',
};

describe('toQuery', () => {
  it('emits only the values that are set', () => {
    expect(toQuery(empty)).toEqual({ page: 1, pageSize: 50, sort: 'publishedAt' });
  });

  it('emits arrays verbatim for the repeated-key format', () => {
    const query = toQuery({ ...empty, type: ['POLICY', 'RESEARCH'], status: ['DEPLOYING'] });
    expect(query.type).toEqual(['POLICY', 'RESEARCH']);
    expect(query.status).toEqual(['DEPLOYING']);
  });

  it('trims the query text and drops it when it is blank', () => {
    expect(toQuery({ ...empty, q: '   ' }).q).toBeUndefined();
    expect(toQuery({ ...empty, q: '  inteligencia ' }).q).toBe('inteligencia');
  });

  it('emits year bounds only when present', () => {
    expect(toQuery({ ...empty, yearFrom: 2020 }).yearTo).toBeUndefined();
    expect(toQuery({ ...empty, yearFrom: 2020 }).yearFrom).toBe(2020);
  });
});

describe('filter state helpers', () => {
  it('detects whether any filter is active', () => {
    expect(isFilterActive(empty)).toBe(false);
    expect(isFilterActive({ ...empty, q: 'ia' })).toBe(true);
    expect(isFilterActive({ ...empty, yearTo: 2026 })).toBe(true);
  });

  it('counts each active dimension once, not each selected value', () => {
    expect(activeFilterCount(empty)).toBe(0);
    expect(activeFilterCount({ ...empty, type: ['POLICY', 'RESEARCH'] })).toBe(1);
    expect(activeFilterCount({ ...empty, type: ['POLICY'], status: ['ACTIVE'] })).toBe(2);
    expect(activeFilterCount({ ...empty, type: ['POLICY'], q: 'ia' })).toBe(2);
  });

  it('toggles a value in and out of a list without duplicates', () => {
    expect(toggleInList(['POLICY'], 'RESEARCH')).toEqual(['POLICY', 'RESEARCH']);
    expect(toggleInList(['POLICY', 'RESEARCH'], 'POLICY')).toEqual(['RESEARCH']);
  });
});