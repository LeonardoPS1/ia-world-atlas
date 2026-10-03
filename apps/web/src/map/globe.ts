import { createMarkerElement } from './markers.ts';
import { clusterAt } from './cluster.ts';
import type { MapDiagnostics } from './diagnostics.ts';
import type { Cluster } from '../state/selectors.ts';

export const INITIAL_CENTER: [number, number] = [-71.543, -33.0472];
export const INITIAL_ZOOM = 2.6;
export const MIN_ZOOM = 1.4;
export const MAX_ZOOM = 11;

export interface MapAdapter {
  mount(container: HTMLElement): void;
  destroy(): void;
  setClusters(clusters: Cluster[]): void;
  focus(cluster: Cluster): void;
  resize(): void;
  readonly mode: 'globe' | 'fallback';
}

export interface GlobeAdapterOptions {
  token: string;
  center: [number, number];
  zoom: number;
  onSelect: (cluster: Cluster) => void;
  onDiagnostics: (diagnostics: MapDiagnostics) => void;
  mapbox?: unknown;
}

interface MapLike {
  options: Record<string, unknown>;
  on(event: string, handler: (payload: never) => void): MapLike;
  once(event: string, handler: (payload: never) => void): MapLike;
  off(event: string): MapLike;
  remove(): void;
  resize(): void;
  easeTo(options: Record<string, unknown>): void;
  project(lngLat: [number, number]): { x: number; y: number };
  getCanvas(): { style: Record<string, string> };
}

export function createGlobeAdapter(options: GlobeAdapterOptions): MapAdapter {
  let map: MapLike | null = null;
  let markerLayer: HTMLElement | null = null;
  let clusters: Cluster[] = [];
  let selectedId: string | null = null;
  let reducedMotion = false;
  const markers = new Map<string, HTMLButtonElement>();
  let container: HTMLElement | null = null;

  const reducedMotionQuery =
    typeof globalThis.matchMedia === 'function'
      ? globalThis.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
  reducedMotion = reducedMotionQuery?.matches ?? false;

  function renderMarkers(): void {
    if (!markerLayer) return;
    const seen = new Set<string>();
    for (const cluster of clusters) {
      seen.add(cluster.locationId);
      const existing = markers.get(cluster.locationId);
      const node =
        existing ??
        createMarkerElement(cluster, {
          selected: selectedId === cluster.locationId,
          reducedMotion,
        });
      if (!existing) {
        node.addEventListener('click', () => options.onSelect(cluster));
        markers.set(cluster.locationId, node);
      }
      node.setAttribute('aria-pressed', String(selectedId === cluster.locationId));
      if (!node.isConnected) markerLayer.append(node);
    }
    for (const [id, node] of markers) {
      if (!seen.has(id)) {
        node.remove();
        markers.delete(id);
      }
    }
  }

  function handleClick(event: never): void {
    if (!map) return;
    const payload = event as unknown as { point: { x: number; y: number } };
    const hit = clusterAt(
      clusters,
      payload.point.x,
      payload.point.y,
      18,
      (cluster) => {
        const projected = map?.project([cluster.lng, cluster.lat]);
        return projected ? [projected.x, projected.y] : [Number.NaN, Number.NaN];
      },
    );
    if (hit) options.onSelect(hit);
  }

  return {
    get mode(): 'globe' | 'fallback' {
      return 'globe';
    },
    mount(target) {
      const MapCtor = (options.mapbox ?? (globalThis as { mapboxgl?: unknown }).mapboxgl) as
        | (new (options: Record<string, unknown>) => MapLike)
        | undefined;
      if (!MapCtor) {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: 'mapboxgl is not loaded',
          styleLoadError: null,
          mode: 'fallback',
          reason: 'Mapbox GL failed to load',
        });
        return;
      }
      container = target;
      markerLayer = document.createElement('div');
      markerLayer.className = 'atlas-markers';
      markerLayer.setAttribute('data-testid', 'marker-layer');
      try {
        map = new MapCtor({
          container: target,
          accessToken: options.token,
          style: 'mapbox://styles/mapbox/dark-v11',
          projection: 'globe',
          center: options.center,
          zoom: options.zoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
          attributionControl: true,
          dragRotate: true,
          pitchWithRotate: false,
        });
      } catch (error) {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: error instanceof Error ? error.message : String(error),
          styleLoadError: null,
          mode: 'fallback',
          reason: 'Mapbox GL constructor threw',
        });
        return;
      }
      map.on('load' as never, (() => {
        target.append(markerLayer as HTMLElement);
        renderMarkers();
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: null,
          styleLoadError: null,
          mode: 'globe',
          reason: null,
        });
      }) as never);
      map.on('click' as never, handleClick as never);
      map.on('error' as never, ((payload: { error?: Error }) => {
        options.onDiagnostics({
          tokenPresent: true,
          webglAvailable: true,
          constructorError: null,
          styleLoadError: payload.error?.message ?? 'style error',
          mode: 'globe',
          reason: null,
        });
      }) as never);
    },
    setClusters(next) {
      clusters = next;
      selectedId = next.length === 1 ? next[0]?.locationId ?? null : null;
      renderMarkers();
    },
    focus(cluster) {
      selectedId = cluster.locationId;
      map?.easeTo({ center: [cluster.lng, cluster.lat], zoom: Math.max(cluster.level === 'LOCAL_AREA' ? 11 : 6, 4), duration: reducedMotion ? 0 : 420 });
      renderMarkers();
    },
    resize() {
      map?.resize();
    },
    destroy() {
      for (const node of markers.values()) node.remove();
      markers.clear();
      markerLayer?.remove();
      markerLayer = null;
      map?.off('click' as never);
      map?.remove();
      map = null;
      void container;
    },
  };
}