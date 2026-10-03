import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  DATABASE_URL: z.string().min(1).optional(),
  TEST_DATABASE_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export interface AppEnv {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  allowWildcardCors: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid environment: ${issues.join('; ')}`);
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const useMemory = source['ATLAS_REPOS'] === 'memory';
  const schema = useMemory ? envSchema : envSchema.required({ DATABASE_URL: true });
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new EnvValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`),
    );
  }
  const { NODE_ENV, PORT, DATABASE_URL, CORS_ORIGIN, LOG_LEVEL } = parsed.data;
  const corsOrigins = CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const isWildcard = corsOrigins.length === 1 && corsOrigins[0] === '*';
  return {
    nodeEnv: NODE_ENV,
    port: PORT,
    databaseUrl: DATABASE_URL ?? '',
    corsOrigins: isWildcard ? ['*'] : corsOrigins,
    allowWildcardCors: isWildcard && NODE_ENV !== 'production',
    logLevel: LOG_LEVEL,
  };
}
