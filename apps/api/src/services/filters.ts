import type { Paginated, ProjectSummary } from '@atlas/contracts';
import type { ProjectsQuery } from '../repositories/types.js';

const STOPWORDS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'en',
  'para',
  'con',
  'un',
  'una',
]);

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchTokensMatch(haystack: string, q: string): boolean {
  const target = fold(haystack);
  const tokens = fold(q)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
  if (tokens.length === 0) return true;
  return tokens.every((token) => target.includes(token));
}

export function matchesProjectFilters(project: ProjectSummary, query: ProjectsQuery): boolean {
  if (query.type && query.type.length > 0 && !query.type.includes(project.type)) return false;
  if (query.status && query.status.length > 0 && !query.status.includes(project.status)) return false;
  if (query.evidence && query.evidence.length > 0 && !query.evidence.includes(project.evidence)) {
    return false;
  }
  if (query.sector && fold(query.sector) !== fold(project.sector ?? '')) return false;
  if (
    query.locationIds &&
    query.locationIds.length > 0 &&
    !query.locationIds.includes(project.locationId)
  ) {
    return false;
  }
  if (query.yearFrom !== undefined && (project.year === null || project.year < query.yearFrom)) {
    return false;
  }
  if (query.yearTo !== undefined && (project.year === null || project.year > query.yearTo)) return false;
  if (query.q) {
    const haystack = [
      project.name,
      project.summary,
      project.sector ?? '',
      project.locationId,
      ...project.tags,
    ].join(' ');
    if (!searchTokensMatch(haystack, query.q)) return false;
  }
  return true;
}

export function sortProjects(list: ProjectSummary[], sort: ProjectsQuery['sort']): ProjectSummary[] {
  const copy = [...list];
  if (sort === 'name') {
    return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }
  return copy.sort((a, b) => {
    const left = a.publishedAt ? Date.parse(a.publishedAt) : Number.NEGATIVE_INFINITY;
    const right = b.publishedAt ? Date.parse(b.publishedAt) : Number.NEGATIVE_INFINITY;
    if (left === right) return a.name.localeCompare(b.name, 'es');
    return right - left;
  });
}

export function paginate<T>(list: T[], page: number, pageSize: number): Paginated<T> {
  const total = list.length;
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
  const start = (page - 1) * pageSize;
  return { data: list.slice(start, start + pageSize), page, pageSize, total, totalPages };
}
