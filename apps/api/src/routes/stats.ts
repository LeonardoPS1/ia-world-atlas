import { Router } from 'express';
import type { AtlasRepositories } from '../repositories/types.ts';

export function createStatsRoute(repos: AtlasRepositories): Router {
  const router = Router();
  router.get('/stats', async (_req, res) => {
    res.json(await repos.stats.overview());
  });
  return router;
}
