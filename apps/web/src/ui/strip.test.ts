import { describe, expect, it, vi } from 'vitest';
import { createStrip, renderStrip } from './strip.ts';
import { createShell } from './shell.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { eventsFixture, listBodies } from '../testing/fixtures.ts';

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

describe('strip', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    const handlers = { onYear: vi.fn(), onPlayToggle: vi.fn(), onStep: vi.fn() };
    return { refs, strip: createStrip(refs.strip, handlers), handlers };
  }

  it('shows the current year and the matching counts', () => {
    const { strip } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.year.getAttribute('data-testid')).toBe('timeline-year');
    expect(strip.year.textContent).toBe('2026');
    expect(strip.counts.textContent).toContain('5');
  });

  it('emits year, step and play events', () => {
    const { strip, handlers } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    strip.slider.value = '2024';
    strip.slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handlers.onYear).toHaveBeenCalledWith(2024);
    // At initial year=2026, prev is enabled, next is disabled
    strip.prev.click();
    expect(handlers.onStep).toHaveBeenCalledWith(-1);
    // next is disabled at max year, so click doesn't fire in jsdom
    strip.play.click();
    expect(handlers.onPlayToggle).toHaveBeenCalled();
  });

  it('labels the play button by its current state', () => {
    const { strip } = setup();
    const store = loaded();
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.play.getAttribute('aria-label')).toBe('Reproducir');
    store.dispatch({ type: 'timeline/play' });
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    expect(strip.play.getAttribute('aria-label')).toBe('Pausar');
  });

  it('lists the events that fall in the selected year', () => {
    const { strip } = setup();
    const store = loaded();
    store.dispatch({ type: 'timeline/setYear', year: 2026 });
    renderStrip(strip, store.getState(), buildSelectors(store.getState()), eventsFixture);
    const events = strip.root.querySelectorAll('[data-testid="timeline-events"] .event-row');
    expect(events.length).toBeGreaterThan(0);
    for (const node of events) {
      expect(node.textContent).toMatch(/2026/);
    }
  });

  it('bounds the slider to the derived year range', () => {
    const { strip } = setup();
    const store = loaded();
    const selectors = buildSelectors(store.getState());
    renderStrip(strip, store.getState(), selectors, eventsFixture);
    expect(Number(strip.slider.min)).toBe(Math.min(...selectors.yearOptions));
    expect(Number(strip.slider.max)).toBe(Math.max(...selectors.yearOptions));
  });
});