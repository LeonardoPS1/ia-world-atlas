import { createMarkerElement } from './markers.ts';
import { el, svgEl } from '../ui/dom.ts';
import { icon } from '../ui/icons.ts';
import { levelLabel } from '../state/colors.ts';
import type { MapAdapter } from './globe.ts';
import type { Cluster } from '../state/selectors.ts';

const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150];
const PARALLELS = [-60, -30, 0, 30, 60];

export function projectToEquirectangular(
  cluster: Pick<Cluster, 'lat' | 'lng'>,
  width: number,
  height: number,
): { x: number; y: number } {
  const x = ((cluster.lng + 180) / 360) * width;
  const y = ((90 - cluster.lat) / 180) * height;
  return { x, y };
}

export interface FallbackOptions {
  host: HTMLElement;
  reason: string;
  onSelect: (projectId: string) => void;
  width?: number;
  height?: number;
}

export function createFallbackAdapter(options: FallbackOptions): MapAdapter {
  const { host, reason, onSelect, width, height } = options;
  let root: HTMLElement | null = null;
  let overlay: HTMLElement | null = null;
  let markerLayer: HTMLElement | null = null;
  let clusters: Cluster[] = [];
  let selectedId: string | null = null;
  let _currentMode: 'globe' | 'fallback' = 'fallback';

  function render(): void {
    if (!root || !overlay || !markerLayer) return;
    const w = width ?? root.clientWidth ?? 960;
    const h = height ?? root.clientHeight ?? 540;

    const graticule = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, role: 'presentation' });
    for (const lng of MERIDIANS) {
      const { x } = projectToEquirectangular({ lat: 0, lng }, w, h);
      graticule.append(
        svgEl('line', { x1: x, y1: 0, x2: x, y2: h, stroke: '#232936', 'stroke-width': 1 }),
      );
    }
    for (const lat of PARALLELS) {
      const { y } = projectToEquirectangular({ lat, lng: 0 }, w, h);
      graticule.append(
        svgEl('line', { x1: 0, y1: y, x2: w, y2: h, stroke: '#232936', 'stroke-width': 1 }),
      );
    }

    markerLayer.replaceChildren();
    for (const cluster of clusters) {
      const { x, y } = projectToEquirectangular(cluster, w, h);
      const marker = createMarkerElement(cluster, { selected: selectedId === cluster.locationId, reducedMotion: true });
      marker.style.position = 'absolute';
      marker.style.left = `${x}px`;
      marker.style.top = `${y}px`;
      marker.addEventListener('click', () => onSelect(cluster.locationId));
      markerLayer.append(marker);
    }

    const list = el('div', { class: 'project-list', 'data-testid': 'project-list' });
    for (const cluster of clusters) {
      if (cluster.count === 0) continue;
      const item = el(
        'button',
        {
          type: 'button',
          class: 'project-list__item',
        },
        [
          el('span', { class: 'project-list__level', text: levelLabel(cluster.level) }),
          el('span', { text: ` · ${cluster.count} ${cluster.count === 1 ? 'proyecto' : 'proyectos'}` }),
        ],
      );
      item.addEventListener('click', () => onSelect(cluster.locationId));
      list.append(item);
    }
    if (list.childNodes.length === 0) {
      list.append(el('p', { class: 'empty-state', text: 'Sin proyectos para los filtros actuales.' }));
    }

    overlay.replaceChildren(graticule, markerLayer, list);
  }

  // Mount the fallback UI
  root = el('div', { class: 'fallback', 'data-testid': 'fallback' });
  const banner = el('div', {
    class: 'fallback__diagnostic',
    'data-testid': 'fallback-diagnostic',
    role: 'status',
  });
  banner.append(icon('layers', 14), el('span', { text: `Vista de datos · ${reason}` }));
  overlay = el('div', { class: 'fallback__graticule' });
  markerLayer = el('div', { class: 'fallback__markers', 'data-testid': 'fallback-markers' });
  overlay.append(markerLayer);
  root.append(banner, overlay);
  host.append(root);

  return {
    setClusters(next) {
      clusters = next;
      render();
    },
    setSelected(id) {
      selectedId = id;
      render();
    },
    focus(id) {
      const cluster = clusters.find((c) => c.locationId === id);
      if (cluster && overlay) {
        const { x, y } = projectToEquirectangular(cluster, options.width ?? 960, options.height ?? 540);
        overlay.scrollTo?.({ left: Math.max(0, x - 120), top: Math.max(0, y - 120) });
      }
    },
    setMode(m) {
      _currentMode = m;
    },
    destroy() {
      root?.remove();
      root = null;
      overlay = null;
      markerLayer = null;
      clusters = [];
    },
  };
}