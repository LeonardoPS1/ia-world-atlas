import { eventsFixture, locationsFixture, projectsFixture } from './fixture-data.ts';
import type { Cluster } from '../state/selectors.ts';
import { EVIDENCE_COLORS, STATUS_COLORS } from '../state/colors.ts';
import { markerShapeFor, markerSizeFor } from '../state/palette.ts';

export { atlasDataFixture, projectsFixture, locationsFixture, eventsFixture, statsFixture } from './fixture-data.ts';
export * from './fixture-data.ts';

const sourcesFor = (projectId: string) => {
  const project = projectsFixture.find((p) => p.id === projectId);
  return project?.sources ?? [];
};

const chileProject = projectsFixture.find((p) => p.id === 'chile-national-ai-policy')!;
/** The detail shape returned by `GET /api/projects/:id` for the Chile project. */
export const projectDetailFixture = {
  ...chileProject,
  id: 'chile-national-ai-policy',
  sources: sourcesFor('chile-national-ai-policy'),
  events: eventsFixture.filter((event) => event.projectId === 'chile-national-ai-policy'),
  relations: [],
  statusHistory: [],
  impactRecords: [],
  geometrySource: 'project' as const,
};

export const listBodies = {
  locations: { data: locationsFixture, page: 1, pageSize: 50, total: 11, totalPages: 1 },
  projects: { data: projectsFixture, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  events: { data: eventsFixture, count: eventsFixture.length },
  relations: { data: [], count: 0 },
} as const;

/** One cluster per fixture location, derived the same way `buildSelectors` derives them. */
export const clustersFixture: Cluster[] = locationsFixture.map((location, index) => ({
  id: `${location.id}::2026`,
  locationId: location.id,
  level: location.level,
  lat: location.latitude,
  lng: location.longitude,
  count: projectsFixture.filter((project) => project.locationId === location.id).length,
  shape: markerShapeFor(location.level),
  size: markerSizeFor(location.level, index / locationsFixture.length),
  color: STATUS_COLORS.ANNOUNCED,
}));

export const fallbackAccents = EVIDENCE_COLORS;