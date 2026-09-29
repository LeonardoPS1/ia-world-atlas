import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';
import { eventsQuerySchema, flattenQuery, parseOr } from '../schemas/query.ts';

export function createEventsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/events', async (req, res) => {
    const query = parseOr(eventsQuerySchema, flattenQuery(req.query), 'events');
    const data = await repos.events.list(query);
    res.json({ data, count: data.length });
  });
  return router;
}
