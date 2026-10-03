import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, breadcrumbTrail, canDescend, descendantIds, isDescendant, normalizeBounds } from './geo.ts';
import { locationsFixture } from '../testing/fixtures.ts';

const byId = (id: string) => {
  const found = locationsFixture.find((location) => location.id === id);
  if (!found) throw new Error(`missing fixture ${id}`);
  return found;
};

describe('hierarchy helpers', () => {
  it('orders levels from world down to local area', () => {
    expect(LEVEL_ORDER).toEqual(['WORLD', 'CONTINENT', 'COUNTRY', 'REGION', 'CITY', 'LOCAL_AREA']);
  });

  it('recognises a direct and a deep descendant', () => {
    expect(isDescendant(locationsFixture, byId('valparaiso').id, 'chile')).toBe(true);
    expect(isDescendant(locationsFixture, byId('pucv-campus').id, 'chile')).toBe(true);
    expect(isDescendant(locationsFixture, byId('singapore').id, 'chile')).toBe(false);
    expect(isDescendant(locationsFixture, 'chile', 'chile')).toBe(false);
  });

  it('expands a subtree including its own root', () => {
    const ids = descendantIds(locationsFixture, 'south-america');
    expect(ids).toContain('south-america');
    expect(ids).toContain('chile');
    expect(ids).toContain('pucv-campus');
    expect(ids).not.toContain('singapore');
  });

  it('builds the breadcrumb from world down to the focused location', () => {
    const trail = breadcrumbTrail(locationsFixture, 'pucv-campus');
    expect(trail.map((location) => location.level)).toEqual([
      'WORLD',
      'CONTINENT',
      'COUNTRY',
      'REGION',
      'CITY',
      'LOCAL_AREA',
    ]);
  });

  it('returns the world entry when nothing is focused', () => {
    expect(breadcrumbTrail(locationsFixture, null)).toEqual([]);
  });

  it('knows when the current level has no children in the data', () => {
    expect(canDescend(locationsFixture, 'LOCAL_AREA')).toBe(false);
    expect(canDescend(locationsFixture, 'COUNTRY')).toBe(true);
  });
});

describe('normalizeBounds', () => {
  it('returns null with no points', () => {
    expect(normalizeBounds([])).toBeNull();
  });

  it('computes a west-south-east-north box', () => {
    const bounds = normalizeBounds([
      { center: { lat: -33.05, lng: -71.6 } },
      { center: { lat: -32.9, lng: -71.4 } },
    ]);
    expect(bounds).toEqual({ west: -71.6, south: -33.05, east: -71.4, north: -32.9 });
  });
});