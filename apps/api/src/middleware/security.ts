import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.js';

export function securityMiddleware(env: AppEnv): RequestHandler[] {
  const allowList = new Set(env.corsOrigins.filter((origin) => origin !== '*'));
  return [
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (env.allowWildcardCors) return callback(null, true);
        if (allowList.has(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: false,
      methods: ['GET', 'HEAD', 'OPTIONS'],
      maxAge: 600,
    }),
  ];
}
