import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, parseOr, relationsQuerySchema } from '../schemas/query.ts';

export function createRelationsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/relations', async (req, res) => {
    const query = parseOr(relationsQuerySchema, flattenQuery(req.query), 'relations');
    const data = await repos.relations.listByProject(query.projectId);
    res.json({ data, count: data.length });
  });
  return router;
}
