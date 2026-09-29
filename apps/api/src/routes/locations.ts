import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, locationsQuerySchema, parseOr } from '../schemas/query.ts';

export function createLocationsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/locations', async (req, res) => {
    const query = parseOr(locationsQuerySchema, flattenQuery(req.query), 'locations');
    res.json(await repos.locations.list(query));
  });
  return router;
}
