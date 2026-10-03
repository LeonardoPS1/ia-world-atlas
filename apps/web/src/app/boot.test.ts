import { describe, expect, it, vi } from 'vitest';
import { boot } from './boot.ts';
import type { MapAdapter } from './boot.ts';
import { createApiClient } from '../data/client.ts';
import { listBodies, atlasDataFixture, projectDetailFixture } from '../testing/fixtures.ts';

function fakeAdapter(): MapAdapter & { setClusters: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn> } {
  return {
    setClusters: vi.fn(),
    setSelected: vi.fn(),
    focus: vi.fn(),
    setMode: vi.fn(),
    destroy: vi.fn(),
  } as never;
}

function harness(options: { detail?: boolean } = {}) {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith('/api/health')
      ? { status: 'ok', api: 'atlas-api', database: 'up', version: '1.0.0', time: new Date().toISOString() }
      : url.includes('/api/stats')
        ? atlasDataFixture.stats
        : url.includes('/api/locations')
          ? listBodies.locations
          : url.includes('/api/events')
            ? { data: atlasDataFixture.events, count: atlasDataFixture.events.length }
            : url.includes('/api/relations')
              ? { data: [], count: 0 }
              : url.includes('/api/projects?')
                ? listBodies.projects
                : options.detail === false
                  ? { data: { id: 'nope', name: 'Nope', type: 'POLICY', status: 'DEPLOYING', evidenceLevel: 'OFFICIAL', sector: null, publishedAt: null, endedAt: null, summary: null, organizations: [], locationIds: [], tags: [], sources: [], events: [], statusHistory: [], relations: [] } }
                  : { data: projectDetailFixture };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const client = createApiClient('/api', { fetchImpl: fetchImpl as unknown as typeof fetch, retryCount: 0 });
  const adapter = fakeAdapter();
  const container = document.createElement('div');
  document.body.append(container);
  const createMap = vi.fn(async () => adapter);
  const app = boot({ container, client, createMap });
  return { container, adapter, createMap, app, client };
}

describe('boot', () => {
  it('mounts the six regions and populates them from the API', async () => {
    const { container } = harness();
    await vi.waitFor(() => {
      expect(container.querySelectorAll('[data-project-id]').length).toBe(5);
    });
    expect(container.querySelector('[data-testid="app-root"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="header"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="rail"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="drawer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="strip"]')).not.toBeNull();
  });

  it('pushes the clusters to the map adapter', async () => {
    const { adapter } = harness();
    await vi.waitFor(() => {
      expect(adapter.setClusters).toHaveBeenCalled();
    });
    const clusters = adapter.setClusters.mock.calls.at(-1)?.[0] as Array<{ id: string; count: number }>;
    expect(clusters.reduce((sum, c) => sum + c.count, 0)).toBe(5);
  });

  it('opens the drawer when a marker selects a project', async () => {
    const { container, adapter } = harness();
    await vi.waitFor(() => expect(adapter.setClusters).toHaveBeenCalled());
    const marker = container.querySelector<HTMLElement>('[data-project-id="chile-national-ai-policy"]');
    expect(marker).not.toBeNull();
    marker?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer"]')?.hasAttribute('hidden')).toBe(false);
    });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer-title"]')?.textContent).toBe('Politica Nacional de Inteligencia Artificial');
    });
  });

  it('closes the drawer without losing the data', async () => {
    const { container } = harness();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-project-id]')).not.toBeNull();
    });
    container.querySelector<HTMLElement>('[data-project-id="chile-national-ai-policy"]')?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer-close"]')).not.toBeNull();
    });
    container.querySelector<HTMLButtonElement>('[data-testid="drawer-close"]')?.click();
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="drawer"]')?.hasAttribute('hidden')).toBe(true);
    });
    expect(container.querySelector('[data-project-id]')).not.toBeNull();
  });

  it('falls back to the data-only map when the map factory rejects', async () => {
    const { container, client } = harness();
    const createMap = vi.fn(async () => {
      throw new Error('WebGL unavailable');
    });
    const app = boot({ container, client, createMap });
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
    });
    expect(container.querySelector('[data-testid="fallback-diagnostic"]')?.textContent).toContain('WebGL unavailable');
    app.dispose();
  });

  it('stops rendering and aborts requests after dispose', async () => {
    const { container, app, adapter } = harness();
    await vi.waitFor(() => expect(adapter.setClusters).toHaveBeenCalled());
    app.dispose();
    expect(adapter.destroy).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="app-root"]')).toBeNull();
  });
});