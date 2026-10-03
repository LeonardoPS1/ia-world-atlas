import type { EvidenceLevel, ProjectStatus, ProjectType } from '../data/types.ts';
import type { StatsResponse } from '@atlas/contracts';

export interface AtlasFilters {
  q: string;
  type: ProjectType[];
  status: ProjectStatus[];
  evidence: EvidenceLevel[];
  yearFrom: number | null;
  yearTo: number | null;
  locationId: string | null;
  sort: 'publishedAt' | 'name';
}

export const EMPTY_FILTERS: AtlasFilters = {
  q: '',
  type: [],
  status: [],
  evidence: [],
  yearFrom: null,
  yearTo: null,
  locationId: null,
  sort: 'publishedAt',
};

export function toQuery(filters: AtlasFilters): Record<string, unknown> {
  const query: Record<string, unknown> = { page: 1, pageSize: 50, sort: filters.sort };
  const q = filters.q.trim();
  if (q.length > 0) query.q = q;
  if (filters.type.length > 0) query.type = filters.type;
  if (filters.status.length > 0) query.status = filters.status;
  if (filters.evidence.length > 0) query.evidence = filters.evidence;
  if (filters.yearFrom !== null) query.yearFrom = filters.yearFrom;
  if (filters.yearTo !== null) query.yearTo = filters.yearTo;
  if (filters.locationId !== null) query.locationId = filters.locationId;
  return query;
}

export function isFilterActive(filters: AtlasFilters): boolean {
  return activeFilterCount(filters) > 0;
}

export function activeFilterCount(filters: AtlasFilters): number {
  let count = 0;
  if (filters.q.trim().length > 0) count += 1;
  if (filters.type.length > 0) count += 1;
  if (filters.status.length > 0) count += 1;
  if (filters.evidence.length > 0) count += 1;
  if (filters.yearFrom !== null || filters.yearTo !== null) count += 1;
  if (filters.locationId !== null) count += 1;
  return count;
}

export function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export type StatsLike = StatsResponse;