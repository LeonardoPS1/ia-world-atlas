import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { createEventsRoute } from './events.ts';
import { createLocationsRoute } from './locations.ts';
import { createProjectsRoute } from './projects.ts';
import { createRelationsRoute } from './relations.ts';
import { createStatsRoute } from './stats.ts';

export function createApiRouter(repos: AtlasRepositories): Router {
  const router = Router();
  router.use(createLocationsRoute(repos));
  router.use(createProjectsRoute(repos));
  router.use(createEventsRoute(repos));
  router.use(createRelationsRoute(repos));
  router.use(createStatsRoute(repos));
  return router;
}
