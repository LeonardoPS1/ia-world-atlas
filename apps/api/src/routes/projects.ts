import { Router } from 'express';
import { HttpError } from '../errors/HttpError.ts';
import type { AtlasRepositories } from '../repositories/types.ts';
import { flattenQuery, parseOr, projectsQuerySchema } from '../schemas/query.ts';

export function createProjectsRoute(repos: AtlasRepositories): Router {
  const router = Router();

  router.get('/projects', async (req, res) => {
    const query = parseOr(projectsQuerySchema, flattenQuery(req.query), 'projects');
    // A location filter has to include everything underneath it, otherwise
    // `?locationId=valparaiso-region` would miss the project recorded at the
    // PUCV campus two levels down.
    const locationIds = query.locationId
      ? await repos.locations.descendantIds(query.locationId)
      : undefined;
    const { locationId: _locationId, ...rest } = query;
    res.json(await repos.projects.list({ ...rest, locationIds }));
  });

  router.get('/projects/:id', async (req, res) => {
    const detail = await repos.projects.findById(req.params.id);
    if (!detail) throw HttpError.notFound(`No project with id ${req.params.id}`);
    res.json({ data: detail });
  });

  return router;
}
