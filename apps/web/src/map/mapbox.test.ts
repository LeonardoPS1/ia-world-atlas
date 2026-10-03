import { describe, expect, it } from 'vitest';
import { MapboxMap } from './mapbox.ts';

describe('mapbox-gl loading', () => {
  it('exposes the Mapbox GL Map constructor', () => {
    expect(typeof MapboxMap).toBe('function');
    expect(typeof (MapboxMap as { prototype?: unknown }).prototype).toBe('object');
  });
});
