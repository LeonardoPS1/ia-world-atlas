import { describe, expect, it } from 'vitest';
import { renderLegend } from './legend.ts';
import { buildSelectors } from '../state/selectors.ts';
import { createInitialState, createStore } from '../state/store.ts';
import { listBodies } from '../testing/fixtures.ts';
import { EVIDENCE_COLORS } from '../state/colors.ts';
import { EVIDENCE_LEVELS, PROJECT_TYPES, PROJECT_STATUSES } from '@atlas/contracts';

function selectors() {
  const store = createStore(createInitialState());
  store.dispatch({ type: 'data/locations', payload: { ...listBodies.locations } });
  store.dispatch({
    type: 'data/projects',
    payload: { data: listBodies.projects.data, page: 1, pageSize: 50, total: 5, totalPages: 1 },
  });
  const statsPayload = {
    totals: { projects: 5, locations: 11, sources: 7 },
    byEvidence: Object.fromEntries(EVIDENCE_LEVELS.map((l) => [l, 0])) as Record<typeof EVIDENCE_LEVELS[number], number>,
    byType: Object.fromEntries(PROJECT_TYPES.map((t) => [t, 0])) as Record<typeof PROJECT_TYPES[number], number>,
    byStatus: Object.fromEntries(PROJECT_STATUSES.map((s) => [s, 0])) as Record<typeof PROJECT_STATUSES[number], number>,
  };
  store.dispatch({ type: 'data/stats', payload: statsPayload });
  // Add some evidence counts for the test
  const state = store.getState();
  if (state.stats) {
    state.stats.byEvidence.REPORTED = 3;
    state.stats.byEvidence.ANNOUNCED = 2;
  }
  return buildSelectors(state);
}

describe('renderLegend', () => {
  it('renders one row per evidence level present in the data', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    const rows = node.querySelectorAll('[data-testid="legend-row"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
  });

  it('uses the semantic palette, not inline hue math', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    for (const level of Object.keys(EVIDENCE_COLORS)) {
      const swatch = node.querySelector(`[data-level="${level}"]`);
      if (!swatch) continue;
      expect(swatch.getAttribute('data-color')).toBe(EVIDENCE_COLORS[level as keyof typeof EVIDENCE_COLORS]);
    }
  });

  it('states the declared intent rather than implying certainty', () => {
    const node = document.createElement('div');
    renderLegend(node, selectors());
    expect(node.textContent).toMatch(/observado|esperado|sin confirmar/);
    expect(node.textContent).toMatch(/Reportado|Oficial|Sin verificar|En disputa|Rumores|Esperado/);
  });

  it('is safe with an empty state', () => {
    const node = document.createElement('div');
    renderLegend(node, buildSelectors(createInitialState()));
    expect(node.querySelectorAll('[data-testid="legend-row"]')).toHaveLength(0);
  });
});