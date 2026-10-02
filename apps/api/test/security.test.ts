import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

function appWith(corsOrigin: string, nodeEnv = 'test') {
  const env = loadEnv({
    NODE_ENV: nodeEnv,
    PORT: '8787',
    DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
    CORS_ORIGIN: corsOrigin,
  } as NodeJS.ProcessEnv);
  return buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger });
}

describe('CORS allowlist', () => {
  it('sets the origin header for an allowed origin', async () => {
    const response = await request(appWith('http://localhost:5173,https://atlas.example'))
      .get('/api/health')
      .set('Origin', 'https://atlas.example');
    expect(response.headers['access-control-allow-origin']).toBe('https://atlas.example');
  });

  it('omits the origin header for a rejected origin', async () => {
    const response = await request(appWith('http://localhost:5173'))
      .get('/api/health')
      .set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('refuses a wildcard origin in production', async () => {
    const response = await request(appWith('*', 'production'))
      .get('/api/health')
      .set('Origin', 'https://anything.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('honours a wildcard only in development', async () => {
    const response = await request(appWith('*', 'development'))
      .get('/api/health')
      .set('Origin', 'https://anything.example');
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('never advertises write methods', async () => {
    const response = await request(appWith('http://localhost:5173')).options('/api/projects');
    expect(response.headers['access-control-allow-methods']).toBeDefined();
    expect(String(response.headers['access-control-allow-methods'])).not.toContain('POST');
  });
});

describe('security headers', () => {
  it('sets helmet headers and hides the framework', async () => {
    const response = await request(appWith('http://localhost:5173')).get('/api/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('body limits', () => {
  it('rejects a body larger than 1mb with a uniform envelope', async () => {
    const response = await request(appWith('http://localhost:5173'))
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send({ padding: 'x'.repeat(1_100_000) });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('anonymous writes', () => {
  it('cannot create a project through any exposed verb', async () => {
    const app = appWith('http://localhost:5173');
    for (const method of ['post', 'put', 'patch', 'delete'] as const) {
      const response = await request(app)[method]('/api/projects').send({ id: 'injected' });
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });
});
