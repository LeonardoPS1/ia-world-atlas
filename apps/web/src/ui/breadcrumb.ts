import { el, clear } from './dom.ts';
import { levelLabel } from '../state/colors.ts';
import type { Location } from '../data/types.ts';

export function renderBreadcrumb(
  node: HTMLElement,
  trail: readonly Location[],
  onFocus: (locationId: string | null) => void,
): void {
  clear(node);
  const items: Location[] = [
    { id: 'world', name: 'Mundo', level: 'WORLD', parentId: null, countryCode: null, longitude: 0, latitude: 0, childCount: 0, projectCount: 0, metadata: {} },
    ...trail.filter((location) => location.level !== 'WORLD'),
  ];
  items.forEach((location, index) => {
    const isLast = index === items.length - 1;
    const button = el(
      'button',
      {
        type: 'button',
        'data-level': location.level,
        'aria-current': isLast ? 'true' : 'false',
        title: levelLabel(location.level),
      },
      [document.createTextNode(location.name)],
    );
    button.addEventListener('click', () => {
      onFocus(isLast ? location.parentId ?? 'world' : location.id);
    });
    if (index > 0) {
      node.append(el('span', { class: 'breadcrumb__sep', 'aria-hidden': 'true', text: '/' }));
    }
    node.append(button);
  });
}