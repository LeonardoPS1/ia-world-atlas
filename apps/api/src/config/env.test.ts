import { describe, expect, it } from 'vitest';
import { EnvValidationError, loadEnv } from './env.js';

const base = {
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv;

describe('loadEnv', () => {
  it('parses a valid environment and splits the cors allowlist', () => {
    const env = loadEnv({ ...base, CORS_ORIGIN: 'http://localhost:5173,https://atlas.example' });
    expect(env.port).toBe(8787);
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'https://atlas.example']);
    expect(env.allowWildcardCors).toBe(false);
  });

  it('trims whitespace around each cors origin', () => {
    const env = loadEnv({ ...base, CORS_ORIGIN: 'http://localhost:5173 , https://atlas.example ' });
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'https://atlas.example']);
  });

  it('rejects a missing DATABASE_URL and names it', () => {
    const withoutDb: NodeJS.ProcessEnv = { NODE_ENV: 'test', PORT: '8787' };
    expect(() => loadEnv(withoutDb)).toThrow(EnvValidationError);
    try {
      loadEnv(withoutDb);
    } catch (error) {
      expect((error as EnvValidationError).issues.join(' ')).toContain('DATABASE_URL');
    }
  });

  it('never allows a wildcard origin in production', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'production', CORS_ORIGIN: '*' });
    expect(env.allowWildcardCors).toBe(false);
  });

  it('allows a wildcard origin only in development', () => {
    const env = loadEnv({ ...base, NODE_ENV: 'development', CORS_ORIGIN: '*' });
    expect(env.allowWildcardCors).toBe(true);
  });

  // A wildcard mixed with concrete origins is not a wildcard. If this ever
  // becomes `corsOrigins.includes('*')` then `*,https://atlas.example` in a
  // production environment silently opens the API to every origin, and the five
  // tests above stay green because none of them mixes the two.
  it('does not treat a wildcard mixed with concrete origins as a wildcard', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'development',
      CORS_ORIGIN: '*,https://atlas.example',
    });
    expect(env.allowWildcardCors).toBe(false);
    expect(env.corsOrigins).toEqual(['*', 'https://atlas.example']);
  });

  it('rejects a non numeric port', () => {
    expect(() => loadEnv({ ...base, PORT: 'eight' })).toThrow(EnvValidationError);
  });
});
