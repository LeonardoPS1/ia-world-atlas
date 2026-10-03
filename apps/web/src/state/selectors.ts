import type {
  AtlasState,
} from './store.ts';
import { STATUS_COLORS, EVIDENCE_COLORS, EVIDENCE_INTENTS, evidenceColor, levelLabel, statusColor } from './colors.ts';
import { breadcrumbTrail, descendantIds } from './geo.ts';
import { markerShapeFor, markerSizeFor } from './palette.ts';
import { pickAccent, visibleProjectsInYear } from '../data/normalize.ts';
import { evidenceSchema, locationLevelSchema, projectStatusSchema } from '@atlas/contracts';
import type {
  EvidenceLevel,
  Location,
  LocationLevel,
  ProjectStatus,
  ProjectSummary,
} from '../data/types.ts';
import type { MarkerShape } from './palette.ts';

export interface Cluster {
  id: string;
  locationId: string;
  level: LocationLevel;
  lat: number;
  lng: number;
  count: number;
  shape: MarkerShape;
  size: number;
  color: string;
}

export interface Selectors {
  breadcrumb: Location[];
  visibleLocations: Location[];
  clusters: Cluster[];
  accent: string;
  levelEnabled: Record<LocationLevel, boolean>;
  visibleYears: number[];
  yearOptions: number[];
  evidenceSummary: Array<{ level: EvidenceLevel; color: string; count: number }>;
  statusSummary: Array<{ status: ProjectStatus; color: string; count: number }>;
  hasSelection: boolean;
  scaleLabel: string;
}

const MAX_DENSITY = 4;

function projectsByLocation(projects: readonly ProjectSummary[], locationId: string): ProjectSummary[] {
  return projects.filter((project) => project.locationId === locationId);
}

function locationCenter(location: Location): { lat: number; lng: number } {
  return { lat: location.latitude, lng: location.longitude };
}

export function buildSelectors(state: AtlasState): Selectors {
  const { projects, locations, focusLocationId, timeline } = state;

  const scoped = focusLocationId ? descendantIds(locations, focusLocationId) : locations.map((l) => l.id);
  const scopedSet = new Set(scoped);
  const visibleLocations = locations.filter((location) => scopedSet.has(location.id));

  const yearProjects = visibleProjectsInYear(projects, timeline.year);
  const scopedProjects = focusLocationId
    ? yearProjects.filter((project) => project.locationId && scopedSet.has(project.locationId))
    : yearProjects;

  const maxCount = visibleLocations.reduce((max, location) => {
    const count = projectsByLocation(scopedProjects, location.id).length;
    return Math.max(max, count);
  }, 0);

  const clusters: Cluster[] = visibleLocations.map((location) => {
    const count = projectsByLocation(scopedProjects, location.id).length;
    const density = maxCount === 0 ? 0 : count / maxCount;
    const leading = scopedProjects.find((project) => project.locationId === location.id);
    return {
      id: `${location.id}::${timeline.year}`,
      locationId: location.id,
      level: location.level,
      lat: locationCenter(location).lat,
      lng: locationCenter(location).lng,
      count,
      shape: markerShapeFor(location.level),
      size: markerSizeFor(location.level, density),
      color: leading ? pickAccent(leading) : STATUS_COLORS.IDEA,
    };
  });

  const levelEnabled = Object.fromEntries(
    locationLevelSchema.options.map((level) => [level, locations.some((l) => l.level === level)]),
  ) as Record<LocationLevel, boolean>;

  const years = projects
    .flatMap((project) => {
      const start = project.publishedAt ? new Date(project.publishedAt).getUTCFullYear() : null;
      // Contracts have no endedAt; only use start year.
      return [start].filter((value): value is number => value !== null && Number.isFinite(value));
    })
    .filter((value) => value > 1900 && value < 2100);
  const yearOptions = years.length > 0 ? years : [timeline.year];
  const visibleYears = yearOptions.filter((year) => year <= timeline.year);

  const evidenceSummary = evidenceSchema.options.map((level) => ({
    level,
    color: evidenceColor(level),
    count: projects.filter((project) => project.evidence === level).length,
  }));

  const statusSummary = projectStatusSchema.options.map((status) => ({
    status,
    color: statusColor(status),
    count: projects.filter((project) => project.status === status).length,
  }));

  const selected = projects.find((project) => project.id === state.selectedProjectId);

  return {
    breadcrumb: breadcrumbTrail(locations, focusLocationId),
    visibleLocations,
    clusters,
    accent: selected ? pickAccent(selected) : STATUS_COLORS.ANNOUNCED,
    levelEnabled,
    visibleYears,
    yearOptions: [...new Set(yearOptions)].sort((a, b) => a - b),
    evidenceSummary,
    statusSummary,
    hasSelection: state.selectedProjectId !== null,
    scaleLabel: levelLabel(state.level),
  };
}

export const SELECTOR_EVIDENCE_COLORS = EVIDENCE_COLORS;
export const SELECTOR_INTENTS = EVIDENCE_INTENTS;
export const SELECTOR_MAX_DENSITY = MAX_DENSITY;