import { createMarkerElement } from './markers.ts';
import { clusterAt } from './cluster.ts';
import type { Cluster } from '../state/selectors.ts';

export const INITIAL_CENTER: [number, number] = [-71.543, -33.0472];
export const INITIAL_ZOOM = 2.6;
export const MIN_ZOOM = 1.4;
export const MAX_ZOOM = 11;

export interface MapAdapter {
  setClusters(clusters: Cluster[]): void;
  setSelected(id: string | null): void;
  focus(id: string): void;
  setMode(mode: 'globe' | 'fallback'): void;
  destroy(): void;
}

export interface GlobeAdapterOptions {
  host: HTMLElement;
  token: string;
  onSelect: (projectId: string) => void;
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

export async function createGlobeAdapter(options: GlobeAdapterOptions): Promise<MapAdapter> {
  const { host, token, onSelect } = options;
  let map: MapLike | null = null;
  let markerLayer: HTMLElement | null = null;
  let clusters: Cluster[] = [];
  let selectedId: string | null = null;
  let reducedMotion = false;
  const markers = new Map<string, HTMLButtonElement>();
  let _currentMode: 'globe' | 'fallback' = 'globe';

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
        node.addEventListener('click', () => onSelect(cluster.locationId));
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
    if (hit) onSelect(hit.locationId);
  }

  const MapCtor = (globalThis as { mapboxgl?: unknown }).mapboxgl as
    | (new (options: Record<string, unknown>) => MapLike)
    | undefined;

  if (!MapCtor) {
    throw new Error('mapboxgl is not loaded');
  }

  markerLayer = document.createElement('div');
  markerLayer.className = 'atlas-markers';
  markerLayer.setAttribute('data-testid', 'marker-layer');

  return new Promise<MapAdapter>((resolve, reject) => {
    try {
      map = new MapCtor({
        container: host,
        accessToken: token,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: 'globe',
        center: INITIAL_CENTER,
        zoom: INITIAL_ZOOM,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        attributionControl: true,
        dragRotate: true,
        pitchWithRotate: false,
      });
    } catch (error) {
      reject(error);
      return;
    }

    map.on('load' as never, (() => {
      host.append(markerLayer as HTMLElement);
      renderMarkers();
      resolve(adapter);
    }) as never);

    map.on('click' as never, handleClick as never);

    map.on('error' as never, ((payload: { error?: Error }) => {
      reject(payload.error ?? new Error('style error'));
    }) as never);
  });

  const adapter: MapAdapter = {
    setClusters(next) {
      clusters = next;
      selectedId = next.length === 1 ? next[0]?.locationId ?? null : null;
      renderMarkers();
    },
    setSelected(id) {
      selectedId = id;
      renderMarkers();
    },
    focus(id) {
      const cluster = clusters.find((c) => c.locationId === id);
      if (cluster) {
        selectedId = id;
        map?.easeTo({ center: [cluster.lng, cluster.lat], zoom: Math.max(cluster.level === 'LOCAL_AREA' ? 11 : 6, 4), duration: reducedMotion ? 0 : 420 });
        renderMarkers();
      }
    },
    setMode(m) {
      _currentMode = m;
    },
    destroy() {
      for (const node of markers.values()) node.remove();
      markers.clear();
      markerLayer?.remove();
      markerLayer = null;
      map?.off('click' as never);
      map?.remove();
      map = null;
    },
  };
}