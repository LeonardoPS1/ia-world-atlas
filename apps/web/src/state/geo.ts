import type { Location, LocationLevel } from '../data/types.ts';

export const LEVEL_ORDER: readonly LocationLevel[] = [
  'WORLD',
  'CONTINENT',
  'COUNTRY',
  'REGION',
  'CITY',
  'LOCAL_AREA',
];

export function isDescendant(
  locations: readonly Location[],
  candidateId: string,
  ancestorId: string,
): boolean {
  if (candidateId === ancestorId) return false;
  let cursor: string | undefined = candidateId;
  const index = new Map(locations.map((location) => [location.id, location]));
  while (cursor) {
    const node: Location | undefined = index.get(cursor);
    if (!node) return false;
    if (node.parentId === ancestorId) return true;
    cursor = node.parentId ?? undefined;
  }
  return false;
}

export function descendantIds(locations: readonly Location[], rootId: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const location of locations) {
    if (!location.parentId) continue;
    const bucket = childrenOf.get(location.parentId) ?? [];
    bucket.push(location.id);
    childrenOf.set(location.parentId, bucket);
  }
  const out: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || out.includes(current)) continue;
    out.push(current);
    queue.push(...(childrenOf.get(current) ?? []));
  }
  return out;
}

export function breadcrumbTrail(locations: readonly Location[], focusId: string | null): Location[] {
  if (focusId === null) return [];
  const index = new Map(locations.map((location) => [location.id, location]));
  const trail: Location[] = [];
  let cursor: string | undefined = focusId;
  while (cursor) {
    const node: Location | undefined = index.get(cursor);
    if (!node) break;
    trail.unshift(node);
    cursor = node.parentId ?? undefined;
  }
  return trail;
}

export function canDescend(locations: readonly Location[], level: LocationLevel): boolean {
  const parentIdsAtLevel = new Set(
    locations.filter((l) => l.level === level).map((l) => l.id)
  );
  return locations.some((location) => location.parentId != null && parentIdsAtLevel.has(location.parentId));
}

export function normalizeBounds(
  points: readonly { center: { lat: number; lng: number } }[],
): { west: number; south: number; east: number; north: number } | null {
  if (points.length === 0) return null;
  const lats = points.map((point) => point.center.lat);
  const lngs = points.map((point) => point.center.lng);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats),
  };
}