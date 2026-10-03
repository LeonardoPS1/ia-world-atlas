import { describe, expect, it, vi } from 'vitest';
import { createInitialState, createStore } from './store.ts';
import type { Action } from './store.ts';
import { listBodies } from '../testing/fixtures.ts';
import type { StatsResponse } from '@atlas/contracts';
import { evidenceSchema, projectStatusSchema, projectTypeSchema } from '@atlas/contracts';

const projectBody = { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 };

const statsFixture: StatsResponse = {
  totals: { projects: 5, locations: 11, sources: 5 },
  byEvidence: Object.fromEntries(evidenceSchema.options.map((k) => [k, 0])) as StatsResponse['byEvidence'],
  byType: Object.fromEntries(projectTypeSchema.options.map((k) => [k, 0])) as StatsResponse['byType'],
  byStatus: Object.fromEntries(projectStatusSchema.options.map((k) => [k, 0])) as StatsResponse['byStatus'],
};

describe('createStore', () => {
  it('starts with no filters, world level and the globe mode', () => {
    const state = createInitialState();
    expect(state.filters.q).toBe('');
    expect(state.level).toBe('WORLD');
    expect(state.mapMode).toBe('globe');
    expect(state.api.status).toBe('idle');
    expect(state.globalTotal).toBe(0);
  });

  it('notifies subscribers only when the state actually changes', () => {
    const store = createStore(createInitialState());
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).toHaveBeenCalledTimes(1);
    const before = listener.mock.calls.length;
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).toHaveBeenCalledTimes(before);
  });

  it('unsubscribes cleanly', () => {
    const store = createStore(createInitialState());
    const listener = vi.fn();
    const off = store.subscribe(listener);
    off();
    store.dispatch({ type: 'filters/set', patch: { q: 'ia' } });
    expect(listener).not.toHaveBeenCalled();
  });

  it('toggles a single filter value and records it', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    expect(store.getState().filters.type).toEqual(['POLICY']);
    store.dispatch({ type: 'filters/toggleValue', key: 'type', value: 'POLICY' });
    expect(store.getState().filters.type).toEqual([]);
  });

  it('keeps the global total from stats and the matching total from the query', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'data/stats', payload: statsFixture });
    store.dispatch({ type: 'data/projects', payload: projectBody });
    const state = store.getState();
    expect(state.globalTotal).toBe(5);
    expect(state.matchingTotal).toBe(5);
    expect(state.projects.data).toHaveLength(5);
  });

  it('resets every filter and closes the drawer without touching the level', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'filters/toggleValue', key: 'status', value: 'DEPLOYING' });
    store.dispatch({ type: 'level/set', level: 'COUNTRY' });
    store.dispatch({ type: 'selection/set', id: 'chile-national-ai-policy' });
    store.dispatch({ type: 'filters/reset' });
    const state = store.getState();
    expect(state.filters.status).toEqual([]);
    expect(state.level).toBe('COUNTRY');
    expect(state.selectedProjectId).toBeNull();
  });

  it('opens the drawer when a project is selected and closes it when cleared', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'selection/set', id: 'eu-ai-factories' });
    expect(store.getState().drawerOpen).toBe(true);
    store.dispatch({ type: 'selection/clear' });
    expect(store.getState().drawerOpen).toBe(false);
  });

  it('clamps the timeline year into range on every set', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'timeline/setYear', year: 1990 });
    expect(store.getState().timeline.year).toBe(store.getState().timeline.minYear);
    store.dispatch({ type: 'timeline/setYear', year: 2999 });
    expect(store.getState().timeline.year).toBe(store.getState().timeline.maxYear);
  });

  it('switches to the fallback mode and records the reason', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'map/mode', payload: { mode: 'fallback', reason: 'Mapbox token missing' } });
    const state = store.getState();
    expect(state.mapMode).toBe('fallback');
    expect(state.fallbackReason).toBe('Mapbox token missing');
  });

  it('records the last requestId on an api error', () => {
    const store = createStore(createInitialState());
    store.dispatch({
      type: 'api/unhealthy',
      detail: 'Invalid request',
    });
    store.dispatch({ type: 'ui/lastRequestId', requestId: 'req-1' });
    expect(store.getState().api.status).toBe('error');
    expect(store.getState().lastRequestId).toBe('req-1');
  });

  it('rejects an unknown action type at compile time', () => {
    const store = createStore(createInitialState());
    const bogus: Action = { type: 'nope' } as never;
    store.dispatch(bogus);
    expect(store.getState().api.status).toBe('idle');
  });
});