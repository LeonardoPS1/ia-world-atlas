import { projectDetailSchema, statsResponseSchema } from '@atlas/contracts';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createFakeRepositories } from '../src/repositories/fake.ts';
import { locationsQuerySchema, projectsQuerySchema } from '../src/schemas/query.ts';
import { atlasDataFixture } from '../src/testing/fixtures.ts';

const env = loadEnv({
  NODE_ENV: 'test',
  PORT: '8787',
  DATABASE_URL: 'postgres://atlas:atlas@127.0.0.1:5432/aiworldatlas',
  CORS_ORIGIN: 'http://localhost:5173,https://atlas.example',
} as NodeJS.ProcessEnv);

const logger = { debug() {}, info() {}, warn() {}, error() {} };
const app = buildApp({ repos: createFakeRepositories(atlasDataFixture), env, logger });

describe('GET /api/locations', () => {
  it('returns a paginated envelope that matches the contract', async () => {
    const response = await request(app).get('/api/locations?page=1&pageSize=5');
    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toEqual(['data', 'page', 'pageSize', 'total', 'totalPages']);
    expect(response.body.total).toBe(11);
  });

  it('filters by level', async () => {
    const response = await request(app).get('/api/locations?level=LOCAL_AREA');
    expect(response.body.data.map((l: { id: string }) => l.id)).toEqual(['pucv-campus']);
  });

  it('rejects an unknown level with a 400 envelope', async () => {
    const response = await request(app).get('/api/locations?level=TOWN');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('GET /api/projects', () => {
  it('returns a paginated envelope and the seeded total', async () => {
    const response = await request(app).get('/api/projects');
    expect(response.body.total).toBe(5);
    expect(response.body.pageSize).toBe(50);
  });

  it('combines repeated type params with OR and status with AND', async () => {
    const response = await request(app).get('/api/projects?type=POLICY&type=INFRASTRUCTURE&status=DEPLOYING');
    expect(response.body.data.map((p: { id: string }) => p.id)).toEqual(['eu-ai-factories']);
  });

  it('accepts comma separated type values', async () => {
    const response = await request(app).get('/api/projects?type=POLICY,INFRASTRUCTURE');
    expect(response.body.total).toBe(3);
  });

  it('expands a parent location into its descendants', async () => {
    const response = await request(app).get('/api/projects?locationId=valparaiso-region');
    expect(response.body.data.map((p: { id: string }) => p.id)).toEqual(['pucv-fondecyt-fuzzy']);
  });

  // The plan shipped `q=politica` on both sides of this test, which is the third
  // time a "with accents and without them" test has contained no accented
  // string. The fixture row really is accented ("Políticas Públicas" in the
  // sector, "Política" in the name), so both spellings have to resolve.
  it('searches with accents and without them', async () => {
    const accented = await request(app).get('/api/projects?q=pol%C3%ADtica');
    const plain = await request(app).get('/api/projects?q=politica');
    expect(accented.body.total).toBe(1);
    expect(plain.body.total).toBe(1);
    expect(accented.body.data.map((p: { id: string }) => p.id)).toEqual(['chile-national-ai-policy']);
  });

  it('paginates with a stable total', async () => {
    const first = await request(app).get('/api/projects?page=1&pageSize=2&sort=name');
    const second = await request(app).get('/api/projects?page=2&pageSize=2&sort=name');
    expect(first.body.total).toBe(5);
    expect(first.body.totalPages).toBe(3);
    expect(second.body.page).toBe(2);
  });

  it('rejects pageSize above 200', async () => {
    const response = await request(app).get('/api/projects?pageSize=500');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/projects/:id', () => {
  it('returns a contract-valid detail payload', async () => {
    const response = await request(app).get('/api/projects/chile-national-ai-policy');
    expect(response.status).toBe(200);
    const parsed = projectDetailSchema.parse(response.body.data);
    expect(parsed.id).toBe('chile-national-ai-policy');
    expect(parsed.sources.length).toBeGreaterThan(0);
    expect(parsed.events.length).toBe(2);
    expect(parsed.statusHistory.length).toBeGreaterThan(0);
  });

  it('answers 404 for an unknown id', async () => {
    const response = await request(app).get('/api/projects/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/events and /api/relations', () => {
  it('returns events with a count', async () => {
    const response = await request(app).get('/api/events?projectId=chile-national-ai-policy');
    expect(response.body.count).toBe(2);
  });

  it('returns an empty relations list without inventing data', async () => {
    const response = await request(app).get('/api/relations?projectId=eu-ai-factories');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], count: 0 });
  });

  it('requires projectId on relations', async () => {
    const response = await request(app).get('/api/relations');
    expect(response.status).toBe(400);
  });
});

describe('GET /api/stats', () => {
  it('returns global totals regardless of filters', async () => {
    const response = await request(app).get('/api/stats');
    const parsed = statsResponseSchema.parse(response.body);
    expect(parsed.totals.projects).toBe(5);
    expect(parsed.totals.locations).toBe(11);
  });
});

describe('write routes', () => {
  it('does not expose POST /api/projects', async () => {
    const response = await request(app).post('/api/projects').send({ id: 'hack' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('does not expose PUT, PATCH or DELETE on projects', async () => {
    for (const method of ['put', 'patch', 'delete'] as const) {
      const response = await request(app)[method]('/api/projects/chile-national-ai-policy');
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('NOT_FOUND');
    }
  });
});

describe('contract drift guard', () => {
  it('keeps the query schemas in sync with the contracts package', () => {
    expect(locationsQuerySchema.safeParse({ page: '1', pageSize: '50' }).success).toBe(true);
    expect(projectsQuerySchema.safeParse({ page: '1', pageSize: '50', sort: 'name' }).success).toBe(true);
  });
});
