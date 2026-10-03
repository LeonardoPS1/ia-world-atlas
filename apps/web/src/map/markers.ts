import { el, svgEl } from '../ui/dom.ts';
import { levelLabel } from '../state/colors.ts';
import type { Cluster } from '../state/selectors.ts';
import type { MarkerShape } from '../state/palette.ts';

const GLYPH: Readonly<Record<MarkerShape, () => SVGElement>> = {
  ring: () => svgEl('circle', { cx: 10, cy: 10, r: 8, fill: 'none', 'stroke-width': 1.25 }),
  circle: () =>
    svgEl('path', {
      d: 'M10 1 a9 9 0 1 0 0.01 0',
      fill: 'none',
      'stroke-width': 1.25,
    }),
  triangle: () => svgEl('path', { d: 'M10 1 L19 17 L1 17 Z', fill: 'none', 'stroke-width': 1.25 }),
  square: () => svgEl('rect', { x: 2, y: 2, width: 16, height: 16, fill: 'none', 'stroke-width': 1.25 }),
  diamond: () => svgEl('path', { d: 'M10 1 L19 10 L10 19 L1 10 Z', fill: 'none', 'stroke-width': 1.25 }),
  dot: () => svgEl('circle', { cx: 10, cy: 10, r: 3.5, fill: 'currentColor' }),
};

export interface MarkerOptions {
  selected: boolean;
  reducedMotion: boolean;
}

export function createMarkerElement(cluster: Cluster, options: MarkerOptions): HTMLButtonElement {
  const classes = ['atlas-marker', `atlas-marker--${cluster.level.toLowerCase()}`];
  if (options.selected) classes.push('atlas-marker--selected');
  if (!options.reducedMotion && cluster.count > 0) {
    classes.push(cluster.level === 'LOCAL_AREA' ? 'marker-pulse' : 'marker-orbit');
  }

  const svg = svgEl('svg', {
    width: cluster.size,
    height: cluster.size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke: cluster.color,
    'aria-hidden': 'true',
    focusable: 'false',
  });
  svg.append(GLYPH[cluster.shape]());

  const button = el('button', {
    type: 'button',
    class: classes.join(' '),
    style: `color: ${cluster.color};`,
    'aria-pressed': String(options.selected),
    'aria-label': `${levelLabel(cluster.level)} · ${cluster.count} ${cluster.count === 1 ? 'proyecto' : 'proyectos'}`,
    'data-cluster-id': cluster.locationId,
    'data-level': cluster.level,
  }) as HTMLButtonElement;

  button.append(svg);
  if (cluster.count > 1) {
    button.append(el('span', { class: 'atlas-marker__count', text: String(cluster.count) }));
  }
  return button;
}