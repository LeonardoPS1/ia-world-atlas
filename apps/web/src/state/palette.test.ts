import { describe, expect, it } from 'vitest';
import { MARKER_SHAPES, markerShapeFor, markerSizeFor } from './palette.ts';
import { locationLevelSchema, projectStatusSchema } from '@atlas/contracts';

describe('marker shapes', () => {
  it('gives each level its own glyph', () => {
    const shapes = locationLevelSchema.options.map((level) => markerShapeFor(level));
    expect(new Set(shapes).size).toBe(locationLevelSchema.options.length);
  });

  it('keeps the largest marker below the non-overlap budget', () => {
    for (const level of locationLevelSchema.options) {
      expect(markerSizeFor(level, 1)).toBeLessThanOrEqual(22);
    }
    // Density increases size for a given level
    expect(markerSizeFor('LOCAL_AREA', 1)).toBeGreaterThan(markerSizeFor('LOCAL_AREA', 0));
    expect(markerSizeFor('WORLD', 1)).toBeGreaterThan(markerSizeFor('WORLD', 0));
  });

  it('exposes the shape table for the legend', () => {
    expect(Object.keys(MARKER_SHAPES)).toEqual([...locationLevelSchema.options]);
  });

  it('does not encode a status in the glyph', () => {
    for (const status of projectStatusSchema.options) {
      expect(Object.values(MARKER_SHAPES)).not.toContain(status.toLowerCase());
    }
  });
});