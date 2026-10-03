import { clear, el } from './dom.ts';
import { EVIDENCE_INTENTS, evidenceLabel } from '../state/colors.ts';
import type { Selectors } from '../state/selectors.ts';

const INTENT_LABEL: Record<string, string> = {
  OBSERVED: 'observado',
  EXPECTED: 'esperado',
  UNCONFIRMED: 'sin confirmar',
};

export function renderLegend(node: HTMLElement, selectors: Selectors): void {
  clear(node);
  const rows = selectors.evidenceSummary.filter((entry) => entry.count > 0);
  if (rows.length === 0) return;
  for (const entry of rows) {
    const row = el('div', { class: 'legend-row', 'data-testid': 'legend-row' });
    row.append(
      el('span', {
        class: 'legend-swatch',
        'data-level': entry.level,
        'data-color': entry.color,
        style: `background: ${entry.color};`,
        'aria-hidden': 'true',
      }),
      el('span', { text: evidenceLabel(entry.level) }),
      el('span', { class: 'counts__secondary', text: INTENT_LABEL[EVIDENCE_INTENTS[entry.level]] }),
      el('span', { class: 'counts__secondary', text: `· ${entry.count}` }),
    );
    node.append(row);
  }
  const total = rows.reduce((sum, entry) => sum + entry.count, 0);
  node.append(
    el('p', {
      class: 'legend-footnote',
      text: `${total} proyectos · el color indica el grado de evidencia`,
    }),
  );
}