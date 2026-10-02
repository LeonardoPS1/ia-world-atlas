import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.ts';

export function securityMiddleware(env: AppEnv): RequestHandler[] {
  const allowList = new Set(env.corsOrigins.filter((origin) => origin !== '*'));
  const corsOptions = env.allowWildcardCors
    ? {
        origin: '*',
        credentials: false as const,
        methods: ['GET', 'HEAD', 'OPTIONS'] as string[],
        maxAge: 600,
      }
    : {
        origin(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
          if (!origin) return callback(null, true);
          if (allowList.has(origin)) return callback(null, true);
          return callback(null, false);
        },
        credentials: false as const,
        methods: ['GET', 'HEAD', 'OPTIONS'] as string[],
        maxAge: 600,
      };
  return [
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
    cors(corsOptions as cors.CorsOptions),
  ];
}
