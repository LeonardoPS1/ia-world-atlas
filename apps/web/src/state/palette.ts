import type { LocationLevel } from '../data/types.ts';

export type MarkerShape = 'circle' | 'ring' | 'triangle' | 'square' | 'diamond' | 'dot';

export const MARKER_SHAPES: Readonly<Record<LocationLevel, MarkerShape>> = {
  WORLD: 'ring',
  CONTINENT: 'circle',
  COUNTRY: 'triangle',
  REGION: 'square',
  CITY: 'diamond',
  LOCAL_AREA: 'dot',
};

const BASE_SIZES: Readonly<Record<LocationLevel, number>> = {
  WORLD: 19,
  CONTINENT: 18,
  COUNTRY: 16,
  REGION: 14,
  CITY: 11,
  LOCAL_AREA: 8,
};

const PROJECT_BONUS = 3;

export function markerShapeFor(level: LocationLevel): MarkerShape {
  return MARKER_SHAPES[level];
}

/** `density` is 0..1: how many projects sit inside the location. Bigger clusters stay smaller. */
export function markerSizeFor(level: LocationLevel, density: number): number {
  const safeDensity = Math.min(1, Math.max(0, density));
  const size = BASE_SIZES[level] + PROJECT_BONUS * safeDensity;
  return Math.round(size);
}