import { describe, expect, it, vi } from 'vitest';
import { createDataController } from './dataController.ts';
import { createApiClient } from '../data/client.ts';
import { createStore, createInitialState } from '../state/store.ts';
import { buildQueryString } from '../data/query.ts';
import { listBodies, atlasDataFixture, locationsFixture } from '../testing/fixtures.ts';

/**
 * The real API filters locations by level. Modelling that here is what makes
 * the first-refresh test able to fail if the controller ever filters the
 * request again: `level=WORLD` would return the single empty world node, which
 * is exactly what hid every project from the map.
 */
function locationsFor(url: string) {
  const level = /[?&]level=([^&]+)/.exec(url)?.[1];
  const data = level ? locationsFixture.filter((location) => location.level === level) : locationsFixture;
  return { ...listBodies.locations, data, total: data.length };
}

function harness() {
  const urls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    // The real API requires a projectId on /relations and answers 400 without
    // one. Modelling that here is what makes the first-refresh test able to
    // fail if the controller ever calls /relations without a selection again.
    if (url.includes('/relations') && !/[?&]projectId=[^&]/.test(url)) {
      return new Response(
        JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'projectId is required', details: [], requestId: 'req-relations' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    const body = url.includes('/projects?')
      ? listBodies.projects
      : url.includes('/projects')
        ? { data: { id: 'chile-national-ai-policy', name: 'Política Nacional de IA 2024', type: 'POLICY', status: 'DEPLOYING', evidenceLevel: 'OFFICIAL', sector: 'Gobierno', publishedAt: '2024-03-01', endedAt: null, summary: null, organizations: [], locationIds: ['pucv-campus'], tags: [] } }
        : url.includes('/locations')
          ? locationsFor(url)
          : url.includes('/events')
            ? { data: atlasDataFixture.events, count: atlasDataFixture.events.length }
            : url.includes('/relations')
              ? { data: [], count: 0 }
              : url.includes('/stats')
                ? atlasDataFixture.stats
                : { status: 'ok', api: 'atlas-api', database: 'up', version: '1.0.0', time: new Date().toISOString() };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
  const store = createStore(createInitialState());
  const controller = createDataController({ client, store, debounceMs: 0 });
  return { client, store, controller, urls };
}

describe('data controller', () => {
  it('loads locations, projects, events and stats on the first refresh', async () => {
    const { controller, store, urls } = harness();
    await controller.refresh();
    expect(urls.some((u) => u.includes('/locations'))).toBe(true);
    // The whole location hierarchy must be loaded: filtering by the active
    // scale left the first load with the empty world node alone, which hid
    // every project from the map and disabled every other scale button.
    expect(urls.some((u) => u.includes('/locations') && !u.includes('level='))).toBe(true);
    expect(urls.some((u) => u.includes('/projects?'))).toBe(true);
    expect(urls.some((u) => u.includes('/events'))).toBe(true);
    // /relations requires a projectId; with no selection the controller must
    // not call it at all (the API answers 400 and would abort the whole load).
    expect(urls.some((u) => u.includes('/relations'))).toBe(false);
    expect(urls.some((u) => u.includes('/stats'))).toBe(true);
    const state = store.getState();
    expect(state.locations.data).toHaveLength(11);
    expect(state.globalTotal).toBe(5);
    expect(state.matchingTotal).toBe(5);
  });

  it('serialises the filters into the query string', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    await controller.refresh();
    const projectsUrl = urls.find((u) => u.includes('/projects?'));
    expect(projectsUrl).toContain(buildQueryString({ type: ['POLICY'] }));
  });

  it('reloads the detail when the selection changes', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'selection/set', id: 'chile-national-ai-policy' });
    await controller.refresh();
    expect(urls.some((u) => u.includes('/projects/chile-national-ai-policy'))).toBe(true);
  });

  it('does not fetch a detail when the selection is cleared', async () => {
    const { controller, store, urls } = harness();
    store.dispatch({ type: 'selection/set', id: 'chile-national-ai-policy' });
    await controller.refresh();
    const before = urls.length;
    store.dispatch({ type: 'selection/clear' });
    await controller.refresh();
    const newUrls = urls.slice(before);
    expect(newUrls.some((u) => u.includes('/projects/chile-national-ai-policy'))).toBe(false);
  });

  it('reports the failure and keeps the previous data', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error', details: [], requestId: 'req-1' } }), { status: 500, headers: { 'content-type': 'application/json' } }));
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch, retryCount: 0 });
    const store = createStore(createInitialState());
    const controller = createDataController({ client, store, debounceMs: 0 });
    await controller.refresh();
    const state = store.getState();
    expect(state.api).toEqual({ status: 'error', detail: 'INTERNAL_ERROR' });
    expect(state.projects.data).toEqual([]);
  });

  it('records the request id so the badge can show it', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/stats') ? atlasDataFixture.stats : url.includes('/locations') ? listBodies.locations : url.includes('/events') ? { data: [], count: 0 } : url.includes('/relations') ? { data: [], count: 0 } : url.includes('/health') ? { status: 'ok', api: 'atlas-api', database: 'up', version: '1.0.0', time: new Date().toISOString() } : listBodies.projects;
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'x-request-id': 'req-42' } });
    });
    const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch });
    const store = createStore(createInitialState());
    const controller = createDataController({ client, store, debounceMs: 0 });
    await controller.refresh();
    expect(store.getState().lastRequestId).toBe('req-42');
  });
});