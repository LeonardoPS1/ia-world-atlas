import { describe, expect, it } from 'vitest';
import { buildSelectors } from './selectors.ts';
import { createInitialState, createStore } from './store.ts';
import { listBodies } from '../testing/fixtures.ts';
import type { StatsResponse } from '@atlas/contracts';

function loadedState() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  // Defect 4 fix: atlasDataFixture.stats doesn't exist; create inline StatsResponse
  const stats: StatsResponse = {
    totals: { projects: 5, locations: 11, sources: 6 },
    byEvidence: { VERIFIED: 0, REPORTED: 4, ANNOUNCED: 1, ANALYSIS: 0, SIGNAL: 0, POSSIBILITY: 0 },
    byType: { PROJECT: 0, NEWS: 0, LAUNCH: 0, COMPANY: 0, GOVERNMENT: 0, UNIVERSITY: 1, RESEARCH: 1, INFRASTRUCTURE: 3, ROBOTICS: 0, POLICY: 1, INVESTMENT: 0, EDUCATION: 0, APPLICATION: 0, IMPACT: 0, SIGNAL: 0, POSSIBILITY: 0 },
    byStatus: { IDEA: 0, RESEARCH: 1, ANNOUNCED: 1, FUNDED: 0, PILOT: 0, BUILDING: 0, DEPLOYING: 1, ACTIVE: 2, SCALING: 0, COMPLETED: 0, PAUSED: 0, CANCELLED: 0 },
  };
  store.dispatch({ type: 'data/stats', payload: stats });
  return store.getState();
}

describe('buildSelectors', () => {
  it('produces one cluster per location, in focus order', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.clusters).toHaveLength(11);
    const levels = selectors.clusters.map((cluster) => cluster.level);
    expect(levels[0]).toBe('WORLD');
  });

  it('marks only the levels present in the data as enabled', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.levelEnabled.LOCAL_AREA).toBe(true);
    expect(selectors.levelEnabled.REGION).toBe(true);
  });

  it('builds the breadcrumb down to the focused location', () => {
    const store = createStore(createInitialState());
    store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
    store.dispatch({ type: 'focus/set', locationId: 'pucv-campus' });
    const selectors = buildSelectors(store.getState());
    // Defect 3 fix: fixture has 'valparaiso' not 'valparaiso-city'
    expect(selectors.breadcrumb.map((location) => location.id)).toEqual([
      'world',
      'south-america',
      'chile',
      'valparaiso-region',
      'valparaiso',
      'pucv-campus',
    ]);
  });

  it('counts projects per evidence level and per status for the legend', () => {
    const selectors = buildSelectors(loadedState());
    const total = selectors.evidenceSummary.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(5);
    const statusTotal = selectors.statusSummary.reduce((sum, entry) => sum + entry.count, 0);
    expect(statusTotal).toBe(5);
  });

  it('derives the year axis from the project windows', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.yearOptions.length).toBeGreaterThan(0);
    expect(selectors.yearOptions[0]).toBeLessThanOrEqual(selectors.yearOptions.at(-1) ?? 0);
  });

  it('exposes a single accent, never a list', () => {
    const selectors = buildSelectors(loadedState());
    expect(selectors.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('reports hasSelection from the store', () => {
    const store = createStore(createInitialState());
    expect(buildSelectors(store.getState()).hasSelection).toBe(false);
    store.dispatch({ type: 'select/project', projectId: 'eu-ai-factories' });
    expect(buildSelectors(store.getState()).hasSelection).toBe(true);
  });

  it('is safe on an empty state', () => {
    const selectors = buildSelectors(createInitialState());
    expect(selectors.clusters).toEqual([]);
    expect(selectors.breadcrumb).toEqual([]);
    expect(selectors.accent).toMatch(/^#[0-9a-f]{6}$/i);
  });
});