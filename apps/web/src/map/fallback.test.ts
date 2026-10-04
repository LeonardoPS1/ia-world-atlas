import { describe, expect, it, vi } from 'vitest';
import { createFallbackAdapter, projectToEquirectangular } from './fallback.ts';
import type { Cluster } from '../state/selectors.ts';
import { clustersFixture } from '../testing/fixtures.ts';

const clusterA: Cluster = {
  id: 'a::2026',
  locationId: 'a',
  level: 'CITY',
  lat: -33.0472,
  lng: -71.543,
  count: 2,
  shape: 'diamond',
  size: 14,
  color: '#4b8cff',
};

const clusterB: Cluster = {
  id: 'b::2026',
  locationId: 'b',
  level: 'CITY',
  lat: -34.0,
  lng: -70.0,
  count: 1,
  shape: 'diamond',
  size: 12,
  color: '#4b8cff',
};

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
    const adapter = createFallbackAdapter({
      host: container,
      reason: 'Mapbox token missing',
      onSelect,
      width: 800,
      height: 400,
    });
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
    expect(onSelect.mock.calls[0]?.[0]).toEqual(expect.any(String));
  });

  it('exposes mode fallback and tears down', () => {
    const { container, adapter } = mountWith(clustersFixture);
    expect(adapter.setMode).toBeDefined();
    adapter.setMode('fallback');
    adapter.destroy();
    expect(container.children).toHaveLength(0);
  });

  it('positions markers at projectToEquirectangular pixel coordinates', () => {
    const { container } = mountWith([clusterA, clusterB]);

    const markerA = container.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    const markerB = container.querySelector<HTMLButtonElement>('[data-cluster-id="b"]');

    expect(markerA).not.toBeNull();
    expect(markerB).not.toBeNull();

    const expectedA = projectToEquirectangular(clusterA, 800, 400);
    const expectedB = projectToEquirectangular(clusterB, 800, 400);

    expect(markerA!.style.left).toBe(`${expectedA.x}px`);
    expect(markerA!.style.top).toBe(`${expectedA.y}px`);
    expect(markerB!.style.left).toBe(`${expectedB.x}px`);
    expect(markerB!.style.top).toBe(`${expectedB.y}px`);

    // Different clusters get different positions
    expect(markerA!.style.left).not.toBe(markerB!.style.left);
    expect(markerA!.style.top).not.toBe(markerB!.style.top);
  });
});
