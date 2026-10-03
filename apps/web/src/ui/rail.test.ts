import { describe, expect, it, vi } from 'vitest';
import { createRail, renderRail } from './rail.ts';
import { createShell } from './shell.ts';
import { createHeader } from './header.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { listBodies } from '../testing/fixtures.ts';
import { projectTypeSchema } from '@atlas/contracts';

function loaded() {
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
  return store;
}

describe('rail', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    createHeader(refs, { onSearch: vi.fn(), onRailToggle: vi.fn() });
    const handlers = {
      onLevel: vi.fn(),
      onToggle: vi.fn(),
      onYearRange: vi.fn(),
      onReset: vi.fn(),
      onFocus: vi.fn(),
    };
    const rail = createRail(refs.rail, handlers);
    return { refs, rail, handlers };
  }

  it('mounts the scale, the filter groups, the legend and a reset button', () => {
    const { rail } = setup();
    const store = loaded();
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    expect(rail.scale.getAttribute('data-testid')).toBe('scale-levels');
    expect(rail.filters.querySelectorAll('[data-filter]').length).toBeGreaterThan(0);
    expect(rail.legend.querySelectorAll('[data-testid="legend-row"]').length).toBeGreaterThan(0);
    expect(rail.reset.getAttribute('data-testid')).toBe('rail-reset');
  });

  it('renders every closed type in the type group', () => {
    const { rail } = setup();
    const chips = rail.filters.querySelectorAll('[data-filter="type"] button');
    expect(chips).toHaveLength(projectTypeSchema.options.length);
  });

  it('marks a chip as pressed and emits the toggle', () => {
    const { rail, handlers } = setup();
    const chip = rail.filters.querySelector<HTMLButtonElement>('[data-filter="type"] button');
    chip?.click();
    expect(handlers.onToggle).toHaveBeenCalledWith('type', projectTypeSchema.options[0]);
  });

  it('reflects the active state after a render', () => {
    const { rail } = setup();
    const store = loaded();
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    const chip = [...rail.filters.querySelectorAll('[data-filter="type"] button')].find(
      (b) => b.getAttribute('data-value') === 'POLICY',
    );
    expect(chip?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables the reset button when nothing is active', () => {
    const { rail } = setup();
    const store = loaded();
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    expect(rail.reset.disabled).toBe(true);
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    renderRail(rail, store.getState(), buildSelectors(store.getState()));
    expect(rail.reset.disabled).toBe(false);
  });
});