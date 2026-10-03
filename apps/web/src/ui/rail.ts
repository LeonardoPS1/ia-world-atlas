import { clear, el } from './dom.ts';
import { evidenceLabel, statusLabel, typeLabel } from '../state/colors.ts';
import { renderLegend } from './legend.ts';
import { renderScale } from './scaleControls.ts';
import { activeFilterCount } from '../state/filters.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { EvidenceLevel, LocationLevel, ProjectStatus, ProjectType } from '../data/types.ts';
import { evidenceSchema, projectStatusSchema, projectTypeSchema } from '@atlas/contracts';

export interface RailHandlers {
  onLevel: (level: LocationLevel) => void;
  onToggle: (key: 'type' | 'status' | 'evidence', value: string) => void;
  onYearRange: (patch: { yearFrom: number | null; yearTo: number | null }) => void;
  onReset: () => void;
  onFocus: (locationId: string) => void;
}

export interface RailRefs {
  root: HTMLElement;
  scale: HTMLElement;
  filters: HTMLElement;
  legend: HTMLElement;
  reset: HTMLButtonElement;
  handlers: RailHandlers;
}

function chipGroup(
  key: 'type' | 'status' | 'evidence',
  selected: readonly string[],
  entries: readonly { value: string; label: string }[],
  onToggle: RailHandlers['onToggle'],
): HTMLElement {
  const group = el('div', { class: 'chip-row', 'data-filter': key });
  for (const entry of entries) {
    const button = el(
      'button',
      {
        type: 'button',
        class: 'chip',
        'data-value': entry.value,
        'aria-pressed': String(selected.includes(entry.value)),
      },
      [document.createTextNode(entry.label)],
    );
    button.addEventListener('click', () => {
      onToggle(key, entry.value);
    });
    group.append(button);
  }
  return group;
}

export function createRail(root: HTMLElement, handlers: RailHandlers): RailRefs {
  clear(root);
  const scaleSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Escala' }),
    el('div', { class: 'scale-levels', 'data-testid': 'scale-levels' }),
  ]);
  const scale = scaleSection.querySelector('.scale-levels') as HTMLElement;

  const filtersSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Filtros' }),
    el('div', { class: 'rail-section__body' }),
  ]);
  const filters = filtersSection.querySelector('.rail-section__body') as HTMLElement;

  const legendSection = el('section', { class: 'rail-section' }, [
    el('h2', { text: 'Evidencia' }),
    el('div', { class: 'legend' }),
  ]);
  const legend = legendSection.querySelector('.legend') as HTMLElement;

  const reset = el('button', {
    type: 'button',
    class: 'chip',
    'data-testid': 'rail-reset',
    disabled: true,
    text: 'Limpiar filtros',
  }) as HTMLButtonElement;
  reset.addEventListener('click', () => {
    handlers.onReset();
  });
  filtersSection.append(reset);

  root.append(scaleSection, filtersSection, legendSection);

  filters.append(
    chipGroup('type', [], projectTypeSchema.options.map((value) => ({ value, label: typeLabel(value as ProjectType) })), handlers.onToggle),
    chipGroup('status', [], projectStatusSchema.options.map((value) => ({ value, label: statusLabel(value as ProjectStatus) })), handlers.onToggle),
    chipGroup('evidence', [], evidenceSchema.options.map((value) => ({ value, label: evidenceLabel(value as EvidenceLevel) })), handlers.onToggle),
  );

  return { root, scale, filters, legend, reset, handlers };
}

export function renderRail(refs: RailRefs, state: AtlasState, selectors: Selectors): void {
  renderScale(refs.scale, state, selectors, (level) => {
    refs.handlers.onLevel(level);
  });

  for (const key of ['type', 'status', 'evidence'] as const) {
    const group = refs.filters.querySelector(`[data-filter="${key}"]`);
    if (!group) continue;
    const selected = state.filters[key] as readonly string[];
    for (const button of group.querySelectorAll<HTMLButtonElement>('button')) {
      const value = button.getAttribute('data-value') ?? '';
      button.setAttribute('aria-pressed', String(selected.includes(value)));
    }
  }

  const active = activeFilterCount(state.filters);
  refs.reset.disabled = active === 0;
  refs.reset.textContent = active === 0 ? 'Limpiar filtros' : `Limpiar filtros (${active})`;

  renderLegend(refs.legend, selectors);
}