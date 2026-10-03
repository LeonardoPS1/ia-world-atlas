import { el } from './dom.ts';

export interface ShellRefs {
  root: HTMLElement;
  header: HTMLElement;
  rail: HTMLElement;
  map: HTMLElement;
  drawer: HTMLElement;
  strip: HTMLElement;
}

export function createShell(host: HTMLElement): ShellRefs {
  const header = el('header', { class: 'atlas-header', 'data-testid': 'header' });
  const rail = el('aside', {
    class: 'atlas-rail',
    'data-testid': 'rail',
    'aria-label': 'Filtros y jerarquía geográfica',
  });
  const map = el('main', {
    class: 'atlas-map',
    'data-testid': 'map-host',
    role: 'region',
    'aria-label': 'Mapa global',
  });
  const drawer = el('aside', {
    class: 'atlas-drawer',
    'data-testid': 'drawer',
    'aria-label': 'Detalle del proyecto',
    hidden: true,
  });
  const strip = el('footer', { class: 'atlas-strip', 'data-testid': 'strip' });

  const root = el('div', { class: 'atlas', 'data-testid': 'app-root' });
  root.append(header, rail, map, drawer, strip);
  host.append(root);
  return { root, header, rail, map, drawer, strip };
}