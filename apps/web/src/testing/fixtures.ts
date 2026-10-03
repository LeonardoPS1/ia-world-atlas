import { eventsFixture, locationsFixture, projectsFixture } from './fixture-data.ts';

export { atlasDataFixture, projectsFixture, locationsFixture, eventsFixture } from './fixture-data.ts';
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