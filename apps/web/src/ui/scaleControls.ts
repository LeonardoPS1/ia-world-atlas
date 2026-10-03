import { clear, el } from './dom.ts';
import { levelLabel } from '../state/colors.ts';
import { LEVEL_ORDER } from '../state/geo.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { LocationLevel } from '../data/types.ts';

export function renderScale(
  node: HTMLElement,
  state: AtlasState,
  selectors: Selectors,
  onLevel: (level: LocationLevel) => void,
): void {
  clear(node);
  for (const level of LEVEL_ORDER) {
    const enabled = selectors.levelEnabled[level];
    const current = state.level === level;
    const button = el(
      'button',
      {
        type: 'button',
        'data-level': level,
        'aria-pressed': String(current),
        disabled: !enabled,
        title: enabled ? levelLabel(level) : `Sin datos a nivel ${levelLabel(level)}`,
      },
      [document.createTextNode(levelLabel(level))],
    );
    if (enabled) {
      button.addEventListener('click', () => {
        onLevel(level);
      });
    }
    node.append(button);
  }
}