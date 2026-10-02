import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';
import { apiErrorSchema } from '@atlas/contracts';
import { HttpError } from '../src/errors/HttpError.ts';

const logger = { debug() {}, info() {}, warn() {}, error() {} };

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173',
} as NodeJS.ProcessEnv);

function appWithExplodingRepos() {
  const repos = createFakeRepositories(atlasDataFixture);
  repos.projects = {
    list: async () => {
      throw new Error('relation "projects_type_check" violates check constraint');
    },
    findById: async () => {
      throw new Error('ECONNREFUSED 127.0.0.1:5432');
    },
  };
  return buildApp({ repos, env, logger });
}

describe('error contract', () => {
  it('returns INTERNAL_ERROR without leaking the database message', async () => {
    const response = await request(appWithExplodingRepos()).get('/api/projects');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body.error.message).toBe('Unexpected server error');
    expect(JSON.stringify(response.body)).not.toContain('check constraint');
    expect(JSON.stringify(response.body)).not.toContain('ECONNREFUSED');
  });

  it('never returns a stack trace', async () => {
    const response = await request(appWithExplodingRepos()).get('/api/projects');
    expect(JSON.stringify(response.body)).not.toContain('at ');
  });

  it('always matches the apiErrorSchema', async () => {
    const responses = await Promise.all([
      request(buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger })).get('/api/projects/nope'),
      request(buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger })).get(
        '/api/projects?pageSize=9999',
      ),
      request(appWithExplodingRepos()).get('/api/projects'),
    ]);
    for (const response of responses) {
      expect(apiErrorSchema.safeParse(response.body).success).toBe(true);
    }
  });

  it('redacts the cause inside HttpError.internal', () => {
    const error = HttpError.internal(new Error('password authentication failed for user "atlas"'));
    expect(error.status).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Unexpected server error');
    expect(error.details).toEqual([]);
    expect(JSON.stringify({ message: error.message, code: error.code, status: error.status })).not.toContain('password');
    expect(error.message).not.toContain('password');
  });
});
