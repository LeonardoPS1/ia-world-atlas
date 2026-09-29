import express from 'express';
import type { Express } from 'express';
import type { AppEnv } from './config/env.ts';
import type { Logger } from './config/logger.ts';
import { errorHandler, notFoundHandler } from './errors/errorHandler.ts';
import { requestId } from './middleware/requestId.ts';
import { securityMiddleware } from './middleware/security.ts';
import type { AtlasRepositories } from './repositories/types.ts';

export interface BuildAppOptions {
  repos: AtlasRepositories;
  env: AppEnv;
  logger: Logger;
  version?: string;
}

export function buildApp(options: BuildAppOptions): Express {
  const { repos, env, logger } = options;
  const version = options.version ?? '0.1.0';
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  for (const middleware of securityMiddleware(env)) app.use(middleware);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => {
    const databaseUp = await repos.health.ping();
    res.status(200).json({
      status: databaseUp ? 'ok' : 'degraded',
      api: 'atlas-api',
      database: databaseUp ? 'up' : 'down',
      version,
      time: new Date().toISOString(),
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
