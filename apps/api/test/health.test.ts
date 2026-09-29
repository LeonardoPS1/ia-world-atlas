import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';
import type { AtlasData } from '../src/testing/types.ts';

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv);

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function app(data: AtlasData = atlasDataFixture) {
  return buildApp({ repos: createFakeRepositories(data), env, logger: silentLogger });
}

describe('GET /api/health', () => {
  it('reports ok when the database answers', async () => {
    const response = await request(app()).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
    expect(response.body.api).toBe('atlas-api');
  });

  it('reports degraded when the database is down', async () => {
    const repos = createFakeRepositories(atlasDataFixture);
    repos.health = { ping: async () => false };
    const response = await request(buildApp({ repos, env, logger: silentLogger })).get('/api/health');
    expect(response.body.status).toBe('degraded');
    expect(response.body.database).toBe('down');
  });

  it('sets an x-request-id header on every response', async () => {
    const response = await request(app()).get('/api/health');
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('answers 404 with a uniform error envelope for unknown routes', async () => {
    const response = await request(app()).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});
