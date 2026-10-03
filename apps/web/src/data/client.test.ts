import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, ContractError, createApiClient } from './client.ts';
import { locationListResponseSchema, projectListResponseSchema } from '@atlas/contracts';
import { atlasDataFixture, projectDetailFixture, projectsFixture } from '../testing/fixtures.ts';

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const locationsBody = {
  data: atlasDataFixture.locations,
  page: 1,
  pageSize: 50,
  total: 11,
  totalPages: 1,
};

const projectsBody = {
  data: atlasDataFixture.projects,
  page: 1,
  pageSize: 50,
  total: 5,
  totalPages: 1,
};

describe('createApiClient', () => {
  it('requests the v1 prefix and serialises the query', async () => {
    const fetchImpl = vi.fn(async () => ok(projectsBody));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await client.projects({ page: 1, pageSize: 50, type: ['POLICY', 'RESEARCH'] });
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0] ?? '');
    expect(url).toContain('/api/projects?');
    expect(url).toContain('type=POLICY&type=RESEARCH');
    expect(url).toContain('pageSize=50');
  });

  it('validates every payload against its contract', async () => {
    const fetchImpl = vi.fn(async () => ok({ ...locationsBody, total: 'eleven' }));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.locations({})).rejects.toBeInstanceOf(ContractError);
  });

  it('surfaces a 400 as ApiRequestError with the code and requestId', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: [], requestId: 'req-9' },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    );
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.projects({ pageSize: 5000 })).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      requestId: 'req-9',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries once on a 503 and then succeeds', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return new Response('', { status: 503 });
      return ok(projectsBody);
    });
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.projects({})).resolves.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 404 }));
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.project('nope')).rejects.toBeInstanceOf(ApiRequestError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    });
    const client = createApiClient('/api', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      retryDelayMs: 0,
    });
    await expect(client.projects({}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves a bare list for relations and events', async () => {
    const client = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: [], count: 0 })) as unknown as typeof fetch,
    });
    await expect(client.relations('eu-ai-factories')).resolves.toEqual({ data: [], count: 0 });
    await expect(client.events({ projectId: 'x' })).resolves.toEqual({ data: [], count: 0 });
  });

  it('reads the project detail from the data envelope', async () => {
    const client = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: projectsFixture.at(0)! })) as unknown as typeof fetch,
    });
    await expect(client.project('chile-national-ai-policy')).rejects.toBeInstanceOf(ContractError);
    const good = createApiClient('/api', {
      fetchImpl: (async () => ok({ data: projectDetailFixture })) as unknown as typeof fetch,
    });
    await expect(good.project('chile-national-ai-policy')).resolves.toMatchObject({
      id: 'chile-national-ai-policy',
    });
  });

  it('exports the schemas it validates with', () => {
    expect(locationListResponseSchema).toBeDefined();
    expect(projectListResponseSchema).toBeDefined();
  });
});