import type { Event, Location, Paginated, ProjectDetail, ProjectSummary, Relation, StatsResponse } from '@atlas/contracts';
import type { AtlasData } from '../testing/types.ts';
import { matchesProjectFilters, paginate, sortProjects } from '../services/filters.ts';
import type {
  AtlasRepositories,
  EventsQuery,
  LocationsQuery,
  ProjectsQuery,
} from './types.ts';

function toSummary(detail: ProjectDetail): ProjectSummary {
  const {
    location: _location,
    sources: _sources,
    events: _events,
    relations: _relations,
    statusHistory: _statusHistory,
    impactRecords: _impactRecords,
    impact: _impact,
    geometrySource: _geometrySource,
    ...summary
  } = detail;
  return summary;
}

export function createFakeRepositories(data: AtlasData): AtlasRepositories {
  return {
    health: {
      async ping() {
        return true;
      },
    },
    locations: {
      async all() {
        return data.locations;
      },
      async list(query: LocationsQuery): Promise<Paginated<Location>> {
        let list = data.locations;
        if (query.parentId) list = list.filter((l) => l.parentId === query.parentId);
        if (query.level) list = list.filter((l) => l.level === query.level);
        const enriched = list.map((l) => ({
          ...l,
          childCount: data.locations.filter((child) => child.parentId === l.id).length,
          projectCount: data.projects.filter((p) => p.locationId === l.id).length,
        }));
        return paginate(enriched, query.page, query.pageSize);
      },
      async descendantIds(id: string) {
        const found = new Set<string>([id]);
        let frontier = [id];
        while (frontier.length > 0) {
          const next: string[] = [];
          for (const current of frontier) {
            for (const child of data.locations.filter((l) => l.parentId === current)) {
              if (!found.has(child.id)) {
                found.add(child.id);
                next.push(child.id);
              }
            }
          }
          frontier = next;
        }
        return [...found];
      },
    },
    projects: {
      async list(query: ProjectsQuery): Promise<Paginated<ProjectSummary>> {
        const summaries = data.projects.map(toSummary);
        const filtered = summaries.filter((summary) => matchesProjectFilters(summary, query));
        return paginate(sortProjects(filtered, query.sort), query.page, query.pageSize);
      },
      async findById(id: string): Promise<ProjectDetail | null> {
        return data.projects.find((p) => p.id === id) ?? null;
      },
    },
    events: {
      async list(query: EventsQuery): Promise<Event[]> {
        let list = data.events;
        if (query.projectId) list = list.filter((e) => e.projectId === query.projectId);
        if (query.yearFrom !== undefined) {
          list = list.filter((e) => Number(e.occurredAt.slice(0, 4)) >= query.yearFrom!);
        }
        if (query.yearTo !== undefined) {
          list = list.filter((e) => Number(e.occurredAt.slice(0, 4)) <= query.yearTo!);
        }
        return [...list].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
      },
    },
    relations: {
      async listByProject(projectId: string): Promise<Relation[]> {
        return data.relations.filter(
          (r) => r.fromProject === projectId || r.toProject === projectId,
        );
      },
    },
    stats: {
      async overview(): Promise<StatsResponse> {
        const count = <T extends string>(values: T[]): Record<string, number> => {
          const output: Record<string, number> = {};
          for (const value of values) output[value] = (output[value] ?? 0) + 1;
          return output;
        };
        return {
          totals: {
            projects: data.projects.length,
            locations: data.locations.length,
            sources: data.sources.length,
          },
          byEvidence: count(data.projects.map((p) => p.evidence)),
          byType: count(data.projects.map((p) => p.type)),
          byStatus: count(data.projects.map((p) => p.status)),
        };
      },
    },
  };
}
