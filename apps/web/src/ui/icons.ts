import { svgEl } from './dom.ts';

export type IconName =
  | 'close'
  | 'search'
  | 'play'
  | 'pause'
  | 'back'
  | 'chevron-left'
  | 'chevron-right'
  | 'layers'
  | 'link'
  | 'target'
  | 'filter'
  | 'clock'
  | 'globe';

const PATHS: Record<IconName, string[]> = {
  close: ['M4 4 L20 20', 'M20 4 L4 20'],
  search: ['M4 12 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0', 'M16 16 L21 21'],
  play: ['M8 5 L19 12 L8 19 Z'],
  pause: ['M9 5 L9 19', 'M15 5 L15 19'],
  back: ['M14 5 L7 12 L14 19', 'M7 12 L21 12'],
  'chevron-left': ['M14 5 L7 12 L14 19'],
  'chevron-right': ['M10 5 L17 12 L10 19'],
  layers: ['M12 3 L21 8 L12 13 L3 8 Z', 'M3 12 L12 17 L21 12', 'M3 16 L12 21 L21 16'],
  link: ['M10 14 a4 4 0 0 0 6 0 l3 -3 a4 4 0 0 0 -6 -6 l-1 1', 'M14 10 a4 4 0 0 0 -6 0 l-3 3 a4 4 0 0 0 6 6 l1 -1'],
  target: ['M12 4 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16', 'M12 2 L12 6', 'M12 18 L12 22', 'M2 12 L6 12', 'M18 12 L22 12'],
  filter: ['M4 6 L20 6', 'M7 12 L17 12', 'M10 18 L14 18'],
  clock: ['M12 4 a8 8 0 1 0 0 16 a8 8 0 1 0 0 -16', 'M12 8 L12 12 L15 14'],
  globe: ['M12 3 a9 9 0 1 0 0 18 a9 9 0 1 0 0 -18', 'M3 12 L21 12', 'M12 3 a14 7 0 0 0 0 18 a14 7 0 0 0 0 -18'],
};

export function icon(name: IconName, size = 16): SVGElement {
  const svg = svgEl('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.25',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  for (const d of PATHS[name]) {
    svg.append(svgEl('path', { d }));
  }
  return svg;
}