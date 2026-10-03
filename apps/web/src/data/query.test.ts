import { describe, expect, it } from 'vitest';
import { buildQueryString } from './query.ts';

describe('buildQueryString', () => {
  it('returns an empty string when nothing survives', () => {
    expect(buildQueryString({ a: undefined, b: null, c: '' })).toBe('');
  });

  it('stringifies scalars', () => {
    expect(buildQueryString({ page: 2, sort: 'name' })).toBe('page=2&sort=name');
  });

  it('repeats a key for each array element', () => {
    expect(buildQueryString({ type: ['POLICY', 'RESEARCH'] })).toBe('type=POLICY&type=RESEARCH');
  });

  it('drops undefined entries inside arrays', () => {
    expect(buildQueryString({ status: ['ACTIVE', undefined as never, 'DEPLOYING'] })).toBe(
      'status=ACTIVE&status=DEPLOYING',
    );
  });

  it('encodes reserved characters', () => {
    expect(buildQueryString({ q: 'política &sey' })).toBe('q=pol%C3%ADtica%20%26sey');
  });

  it('is stable regardless of key order', () => {
    expect(buildQueryString({ b: 2, a: 1 })).toBe('a=1&b=2');
  });
});