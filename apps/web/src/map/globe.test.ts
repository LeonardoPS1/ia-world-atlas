import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, MIN_ZOOM, createGlobeAdapter } from './globe.ts';
import type { Cluster } from '../state/selectors.ts';

function fakeMapClass() {
  const instances: Array<{
    options: Record<string, unknown>;
    fire: (event: string, payload: unknown) => void;
    handlers: Map<string, (event: unknown) => void>;
    projectImpl: (lngLat: [number, number]) => { x: number; y: number };
  }> = [];

  class FakeMap {
    options: Record<string, unknown>;
    handlers = new Map<string, (event: unknown) => void>();
    projectImpl: (lngLat: [number, number]) => { x: number; y: number };

    constructor(options: Record<string, unknown>) {
      this.options = options;
      this.projectImpl = (lngLat: [number, number]) => ({ x: lngLat[0] * 10 + 400, y: -lngLat[1] * 10 + 200 });
      instances.push(this);
    }

    on(event: string, handler: (event: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    once(event: string, handler: (event: unknown) => void) {
      this.handlers.set(event, handler);
      return this;
    }

    off(event: string) {
      this.handlers.delete(event);
      return this;
    }

    fire(event: string, payload: unknown) {
      this.handlers.get(event)?.(payload);
    }

    project(lngLat: [number, number]) {
      return this.projectImpl(lngLat);
    }

    addSource = vi.fn();
    addLayer = vi.fn();
    removeLayer = vi.fn();
    remove = vi.fn();
    resize = vi.fn();
    easeTo = vi.fn();
    flyTo = vi.fn();
    setProjection = vi.fn();
    querySourceFeatures = vi.fn(() => []);
    getCanvas = vi.fn(() => ({ style: {} }));
  }

  return { FakeMap, instances };
}

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

describe('globe defaults', () => {
  it('pins the initial camera to Viña del Mar without rotation', () => {
    expect(INITIAL_CENTER).toEqual([-71.543, -33.0472]);
    expect(INITIAL_ZOOM).toBeLessThan(4);
    expect(MIN_ZOOM).toBeLessThan(INITIAL_ZOOM);
    expect(MAX_ZOOM).toBeGreaterThan(INITIAL_ZOOM);
  });
});

describe('createGlobeAdapter', () => {
  it('requests the globe projection and disables autorotate', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;
    expect(instances.length).toBe(1);
    const options = (instances[0] as { options?: Record<string, unknown> }).options ?? {};
    expect(options.projection).toBe('globe');
    adapter.destroy();
  });

  it('positions markers at map.project() pixel coordinates', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;

    adapter.setClusters([clusterA]);

    const markerLayer = host.querySelector('[data-testid="marker-layer"]') as HTMLElement;
    expect(markerLayer).not.toBeNull();

    const marker = markerLayer.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    expect(marker).not.toBeNull();

    const expectedX = clusterA.lng * 10 + 400;
    const expectedY = -clusterA.lat * 10 + 200;
    expect(marker!.style.left).toBe(`${expectedX}px`);
    expect(marker!.style.top).toBe(`${expectedY}px`);

    adapter.destroy();
  });

  it('gives different positions to clusters at different coordinates', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;

    adapter.setClusters([clusterA, clusterB]);

    const markerLayer = host.querySelector('[data-testid="marker-layer"]') as HTMLElement;
    const markerA = markerLayer.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    const markerB = markerLayer.querySelector<HTMLButtonElement>('[data-cluster-id="b"]');

    expect(markerA).not.toBeNull();
    expect(markerB).not.toBeNull();

    expect(markerA!.style.left).not.toBe(markerB!.style.left);
    expect(markerA!.style.top).not.toBe(markerB!.style.top);

    adapter.destroy();
  });

  it('repositions markers on map move event', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;

    adapter.setClusters([clusterA]);

    const markerLayer = host.querySelector('[data-testid="marker-layer"]') as HTMLElement;
    const marker = markerLayer.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    expect(marker).not.toBeNull();

    const initialLeft = marker!.style.left;
    const initialTop = marker!.style.top;

    // Mutate the project implementation to return different coordinates
    instances[0].projectImpl = (lngLat: [number, number]) => ({ x: lngLat[0] * 5 + 100, y: -lngLat[1] * 5 + 50 });

    // Fire move event
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('move', {});

    const expectedX = clusterA.lng * 5 + 100;
    const expectedY = -clusterA.lat * 5 + 50;
    expect(marker!.style.left).toBe(`${expectedX}px`);
    expect(marker!.style.top).toBe(`${expectedY}px`);
    expect(marker!.style.left).not.toBe(initialLeft);
    expect(marker!.style.top).not.toBe(initialTop);

    adapter.destroy();
  });

  it('repositions markers on map zoom event', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;

    adapter.setClusters([clusterA]);

    const markerLayer = host.querySelector('[data-testid="marker-layer"]') as HTMLElement;
    const marker = markerLayer.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    expect(marker).not.toBeNull();

    const initialLeft = marker!.style.left;
    const initialTop = marker!.style.top;

    // Mutate the project implementation to return different coordinates
    instances[0].projectImpl = (lngLat: [number, number]) => ({ x: lngLat[0] * 20 + 800, y: -lngLat[1] * 20 + 400 });

    // Fire zoom event
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('zoom', {});

    const expectedX = clusterA.lng * 20 + 800;
    const expectedY = -clusterA.lat * 20 + 400;
    expect(marker!.style.left).toBe(`${expectedX}px`);
    expect(marker!.style.top).toBe(`${expectedY}px`);
    expect(marker!.style.left).not.toBe(initialLeft);
    expect(marker!.style.top).not.toBe(initialTop);

    adapter.destroy();
  });

  it('tears down cleanly: removes markers and detaches marker layer', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onSelect = vi.fn();
    const host = document.createElement('div');
    const adapterPromise = createGlobeAdapter({ host, token: 'pk.test', onSelect, mapbox: FakeMap as never });
    (instances[0] as { fire: (e: string, p: unknown) => void }).fire('load', {});
    const adapter = await adapterPromise;

    adapter.setClusters([clusterA]);

    const markerLayer = host.querySelector('[data-testid="marker-layer"]');
    expect(markerLayer).not.toBeNull();
    // Marker layer is a child of host (host is not in document, so isConnected is false)
    expect(markerLayer!.parentElement).toBe(host);

    const marker = markerLayer!.querySelector<HTMLButtonElement>('[data-cluster-id="a"]');
    expect(marker).not.toBeNull();
    expect(marker!.parentElement).toBe(markerLayer);

    adapter.destroy();

    // After destroy, marker layer should be removed from host
    expect(markerLayer!.parentElement).toBeNull();
    // Marker should be removed from marker layer
    expect(marker!.parentElement).toBeNull();
    // Map remove should have been called
    expect(instances[0].remove).toHaveBeenCalled();
  });
});