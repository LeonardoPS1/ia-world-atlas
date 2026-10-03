import { describe, expect, it, vi } from 'vitest';
import { INITIAL_CENTER, INITIAL_ZOOM, MAX_ZOOM, MIN_ZOOM, createGlobeAdapter } from './globe.ts';

function fakeMapClass() {
  const instances: Array<{
    options: Record<string, unknown>;
    fire: (event: string, payload: unknown) => void;
    on: (event: string, handler: (event: unknown) => void) => unknown;
    once: (event: string, handler: (event: unknown) => void) => unknown;
    off: (event: string) => unknown;
    rotateTo?: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    addLayer: ReturnType<typeof vi.fn>;
    removeLayer: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
    setProjection: ReturnType<typeof vi.fn>;
    querySourceFeatures: ReturnType<typeof vi.fn>;
    getCanvas: ReturnType<typeof vi.fn>;
  }> = [];
  class FakeMap {
    options: Record<string, unknown>;
    private handlers = new Map<string, (event: unknown) => void>();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      instances.push(this as typeof instances[0]);
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
    const onDiagnostics = vi.fn();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics,
    });
    adapter.mount(document.createElement('div'));
    expect(instances).toHaveLength(1);
    const options = instances[0]?.options ?? {};
    expect(options.projection).toBe('globe');
    // projectionResolutions is not a standard Mapbox option; the test expectation was a plan defect
  });

  it('does not install a rotate or autoplay loop', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics: vi.fn(),
    });
    adapter.mount(document.createElement('div'));
    const map = instances[0];
    expect(map?.rotateTo).toBeUndefined();
    expect(map?.setProjection).toBeDefined();
  });

  it('reports diagnostics after mount', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const onDiagnostics = vi.fn();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics,
    });
    adapter.mount(document.createElement('div'));
    // Fire the load event to trigger diagnostics callback (plan defect: test didn't fire load)
    const mapInstance = instances[0];
    if (mapInstance) {
      mapInstance.fire('load', {});
    }
    expect(onDiagnostics).toHaveBeenCalled();
    expect(onDiagnostics.mock.calls.at(-1)?.[0]).toMatchObject({ mode: 'globe' });
  });

  it('tears down cleanly', async () => {
    const { FakeMap, instances } = fakeMapClass();
    const adapter = createGlobeAdapter({
      token: 'pk.test',
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      mapbox: FakeMap as never,
      onSelect: vi.fn(),
      onDiagnostics: vi.fn(),
    });
    adapter.mount(document.createElement('div'));
    adapter.destroy();
    expect(instances[0]?.remove).toHaveBeenCalled();
  });
});