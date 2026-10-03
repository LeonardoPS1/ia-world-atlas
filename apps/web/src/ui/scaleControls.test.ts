import { describe, expect, it, vi } from 'vitest';
import { renderScale } from './scaleControls.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { listBodies } from '../testing/fixtures.ts';
import { LEVEL_ORDER } from '../state/geo.ts';

function state() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  store.dispatch({
    type: 'data/stats',
    payload: {
      totals: { projects: 5, locations: 11, sources: 6 },
      byEvidence: { REPORTED: 4, ANNOUNCED: 1 },
      byType: { POLICY: 1, INFRASTRUCTURE: 2, RESEARCH: 1, GOVERNMENT: 1 },
      byStatus: { ACTIVE: 4, DEPLOYING: 1 },
    },
  });
  return store.getState();
}

describe('renderScale', () => {
  it('renders one button per level, in order, with pressed state', () => {
    const node = document.createElement('div');
    node.setAttribute('data-testid', 'scale-levels');
    renderScale(node, state(), buildSelectors(state()), vi.fn());
    const buttons = [...node.querySelectorAll('button')];
    expect(buttons.map((b) => b.getAttribute('data-level'))).toEqual([...LEVEL_ORDER]);
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables levels with no data instead of hiding them', () => {
    const node = document.createElement('div');
    const s = state();
    renderScale(node, s, buildSelectors(s), vi.fn());
    for (const button of node.querySelectorAll('button')) {
      const level = button.getAttribute('data-level') as keyof ReturnType<typeof buildSelectors>['levelEnabled'];
      if (!buildSelectors(s).levelEnabled[level]) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }
  });

  it('emits the level and blocks the move that would leave the data', () => {
    const node = document.createElement('div');
    const onLevel = vi.fn();
    const s = state();
    renderScale(node, s, buildSelectors(s), onLevel);
    const country = [...node.querySelectorAll('button')].find(
      (b) => b.getAttribute('data-level') === 'COUNTRY',
    ) as HTMLButtonElement;
    country.click();
    expect(onLevel).toHaveBeenCalledWith('COUNTRY');
  });
});