import { describe, expect, it, vi } from 'vitest';
import { createFallbackAdapter, projectToEquirectangular } from './fallback.ts';
import type { Cluster } from '../state/selectors.ts';
import { clustersFixture } from '../testing/fixtures.ts';

describe('projectToEquirectangular', () => {
  it('maps the equator to the vertical middle', () => {
    const point = projectToEquirectangular(clustersFixture.find((c) => c.lat === 0) ?? { ...clustersFixture[0], lat: 0, lng: 0 }, 800, 400);
    expect(point.y).toBeCloseTo(200, 5);
  });

  it('maps the prime meridian to the horizontal middle', () => {
    const point = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: 0 }, 800, 400);
    expect(point.x).toBeCloseTo(400, 5);
  });

  it('puts the eastern hemisphere on the right', () => {
    const east = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: 120 }, 800, 400);
    const west = projectToEquirectangular({ ...clustersFixture[0], lat: 0, lng: -120 }, 800, 400);
    expect(east.x).toBeGreaterThan(west.x);
  });

  it('keeps every point inside the viewport', () => {
    for (const cluster of clustersFixture) {
      const { x, y } = projectToEquirectangular(cluster, 800, 400);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(800);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(400);
    }
  });
});

describe('createFallbackAdapter', () => {
  function mountWith(clusters: Cluster[]) {
    const container = document.createElement('div');
    document.body.append(container);
    const onSelect = vi.fn();
    const adapter = createFallbackAdapter({ reason: 'Mapbox token missing', onSelect, width: 800, height: 400 });
    adapter.mount(container);
    adapter.setClusters(clusters);
    return { container, adapter, onSelect };
  }

  it('renders a visible diagnostic explaining the fallback', () => {
    const { container } = mountWith(clustersFixture);
    const diagnostic = container.querySelector('[data-testid="fallback-diagnostic"]');
    expect(diagnostic).not.toBeNull();
    expect(diagnostic?.textContent).toContain('Mapbox token missing');
  });

  it('renders a graticule and a list, and no vendor basemap', () => {
    const { container } = mountWith(clustersFixture);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-testid="project-list"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('mapbox');
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders one interactive marker per cluster', () => {
    const { container } = mountWith(clustersFixture);
    expect(container.querySelectorAll('[data-cluster-id]')).toHaveLength(clustersFixture.length);
  });

  it('reports the selection when a marker is activated', () => {
    const { container, onSelect } = mountWith(clustersFixture);
    const first = container.querySelector<HTMLButtonElement>('[data-cluster-id]');
    first?.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ locationId: expect.any(String) });
  });

  it('exposes mode fallback and tears down', () => {
    const { container, adapter } = mountWith(clustersFixture);
    expect(adapter.mode).toBe('fallback');
    adapter.destroy();
    expect(container.children).toHaveLength(0);
  });
});