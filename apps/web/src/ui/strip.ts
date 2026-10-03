import { clear, el } from './dom.ts';
import { icon } from './icons.ts';
import { eventsInYear } from '../state/timeline.ts';
import type { AtlasState } from '../state/store.ts';
import type { Selectors } from '../state/selectors.ts';
import type { EventRecord } from '../data/types.ts';

export interface StripHandlers {
  onYear: (year: number) => void;
  onPlayToggle: () => void;
  onStep: (delta: number) => void;
}

export interface StripRefs {
  root: HTMLElement;
  year: HTMLElement;
  slider: HTMLInputElement;
  play: HTMLButtonElement;
  prev: HTMLButtonElement;
  next: HTMLButtonElement;
  counts: HTMLElement;
  events: HTMLElement;
}

const YEAR_FORMAT = new Intl.DateTimeFormat('es-CL', { year: 'numeric' });

export function createStrip(root: HTMLElement, handlers: StripHandlers): StripRefs {
  clear(root);

  const year = el('span', { class: 'timeline__year', 'data-testid': 'timeline-year' });

  const prev = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Año anterior',
    'data-testid': 'timeline-prev',
  }) as HTMLButtonElement;
  prev.append(icon('chevron-left', 16));
  prev.addEventListener('click', () => {
    handlers.onStep(-1);
  });

  const next = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Año siguiente',
    'data-testid': 'timeline-next',
  }) as HTMLButtonElement;
  next.append(icon('chevron-right', 16));
  next.addEventListener('click', () => {
    handlers.onStep(1);
  });

  const play = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Reproducir',
    'data-testid': 'timeline-play',
  }) as HTMLButtonElement;
  play.addEventListener('click', () => {
    handlers.onPlayToggle();
  });

  const slider = el('input', {
    type: 'range',
    class: 'timeline__slider',
    'data-testid': 'timeline-slider',
    min: '1900',
    max: '2100',
    step: '1',
    'aria-label': 'Año',
  }) as HTMLInputElement;
  slider.addEventListener('input', () => {
    handlers.onYear(Number(slider.value));
  });

  const track = el('div', { class: 'timeline__track' }, [slider]);
  const controls = el('div', { class: 'timeline' }, [year, prev, track, next, play]);
  const counts = el('div', { class: 'counts' });
  const events = el('div', { class: 'timeline-events', 'data-testid': 'timeline-events' });
  root.append(controls, counts, events);
  return { root, year, slider, play, prev, next, counts, events };
}

export function renderStrip(
  refs: StripRefs,
  state: AtlasState,
  selectors: Selectors,
  events: readonly EventRecord[],
): void {
  const { year: current, playing, minYear, maxYear } = state.timeline;
  refs.year.textContent = String(current);

  const yearOptions = selectors.yearOptions;
  const min = yearOptions.length > 0 ? Math.min(...yearOptions) : minYear;
  const max = yearOptions.length > 0 ? Math.max(...yearOptions) : maxYear;
  refs.slider.min = String(min);
  refs.slider.max = String(max);
  refs.slider.value = String(current);
  refs.slider.setAttribute('aria-valuetext', String(current));

  refs.prev.disabled = current <= min;
  refs.next.disabled = current >= max;
  refs.play.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
  clear(refs.play);
  refs.play.append(icon(playing ? 'pause' : 'play', 16));

  clear(refs.counts);
  refs.counts.append(
    el('span', { class: 'counts__primary', text: String(state.matchingTotal) }),
    el('span', { class: 'counts__secondary', text: `de ${state.globalTotal} proyectos` }),
  );

  clear(refs.events);
  const inYear = eventsInYear(events, current);
  if (inYear.length === 0) {
    const yearDate = new Date(Date.UTC(current, 0, 1));
    refs.events.append(el('p', { class: 'empty-state', text: `Sin hitos registrados en ${YEAR_FORMAT.format(yearDate)}.` }));
    return;
  }
  for (const event of inYear) {
    const year = new Date(event.occurredAt).getUTCFullYear();
    refs.events.append(
      el('div', { class: 'event-row' }, [
        el('span', { class: 'event-row__date', text: String(year) }),
        el('span', { class: 'event-row__title', text: event.title }),
      ]),
    );
  }
}