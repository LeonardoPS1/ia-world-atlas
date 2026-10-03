import { clear, el } from './dom.ts';
import { icon } from './icons.ts';
import { safeExternalUrl } from '../data/urls.ts';
import { evidenceLabel, evidenceIntent, statusLabel, typeLabel } from '../state/colors.ts';
import { sortSources, sortTimelineEvents } from '../data/normalize.ts';
import type { ProjectDetail } from '../data/types.ts';
import type { Source } from '@atlas/contracts';

export interface DrawerHandlers {
  onClose: () => void;
  onFocus: (locationId: string) => void;
}

export interface DrawerRefs {
  root: HTMLElement;
  title: HTMLElement;
  body: HTMLElement;
  close: HTMLButtonElement;
}

const INTENT_LABEL: Record<string, string> = {
  OBSERVED: 'observado',
  EXPECTED: 'esperado',
  UNCONFIRMED: 'sin confirmar',
};

const DATE_FORMAT = new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: 'short' });

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : DATE_FORMAT.format(date);
}

function sourceLabel(sourceId: string | null, sources: readonly Source[]): string {
  if (!sourceId) return 'Fuente';
  const source = sources.find((s) => s.id === sourceId);
  return source?.name ?? 'Fuente';
}

export function createDrawer(root: HTMLElement, handlers: DrawerHandlers): DrawerRefs {
  clear(root);
  const close = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Cerrar detalle',
    'data-testid': 'drawer-close',
  }) as HTMLButtonElement;
  close.append(icon('close', 16));
  close.addEventListener('click', () => {
    handlers.onClose();
  });

  const title = el('h2', { 'data-testid': 'drawer-title' });
  const header = el('div', { class: 'drawer-header' }, [title, close]);
  const body = el('div', { class: 'drawer-body' });
  root.append(header, body);
  return { root, title, body, close };
}

export function renderDrawer(
  refs: DrawerRefs,
  detail: ProjectDetail | null,
  options: { allowHttp: boolean },
): void {
  clear(refs.body);
  if (!detail) {
    refs.title.textContent = 'Ningún proyecto seleccionado';
    refs.body.append(el('p', { class: 'empty-state', text: 'Elegí un pin o una fila para ver el detalle.' }));
    refs.root.setAttribute('hidden', '');
    return;
  }

  refs.root.removeAttribute('hidden');
  refs.title.textContent = detail.name;

  if (detail.summary) {
    refs.body.append(el('p', { class: 'drawer-summary', text: detail.summary }));
  }

  const meta = el('dl', { class: 'meta-grid' });
  const rows: Array<[string, string]> = [
    ['Tipo', typeLabel(detail.type)],
    ['Estado', statusLabel(detail.status)],
    ['Evidencia', `${evidenceLabel(detail.evidence)} · ${INTENT_LABEL[evidenceIntent(detail.evidence)]}`],
    ['Publicado', formatDate(detail.publishedAt)],
    ['Fin', formatDate(null)],
  ];
  if (detail.sector) rows.push(['Sector', detail.sector]);
  for (const [label, value] of rows) {
    meta.append(el('dt', { text: label }), el('dd', { text: value }));
  }
  refs.body.append(meta);

  const sources = sortSources(detail.sources);
  if (sources.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Fuentes' }));
    for (const source of sources) {
      const card = el('div', { class: 'source-card', 'data-source-id': source.id });
      card.append(el('p', { class: 'source-card__title', text: source.name }));
      const href = safeExternalUrl(source.url, { allowHttp: options.allowHttp });
      if (href) {
        const link = el('a', {
          class: 'source-card__url',
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          'data-testid': 'source-link',
        }) as HTMLAnchorElement;
        link.append(icon('link', 12), document.createTextNode(source.name ?? new URL(href).host));
        card.append(link);
      } else {
        const plain = el('span', { class: 'source-card__url source-card__url--plain', 'data-testid': 'source-text' });
        plain.append(icon('target', 12), document.createTextNode(`${source.name ?? 'Fuente'} · enlace no seguro`));
        card.append(plain);
      }
      if (source.snippet) {
        card.append(el('p', { class: 'source-card__snippet', text: source.snippet }));
      }
      if (source.isPrimary) {
        card.append(el('span', { class: 'evidence-chip', text: 'Fuente primaria' }));
      }
      refs.body.append(card);
    }
  }

  const events = sortTimelineEvents(detail.events);
  if (events.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Hitos' }));
    for (const event of events) {
      refs.body.append(
        el('div', { class: 'event-row' }, [
          el('span', { class: 'event-row__date', text: formatDate(event.occurredAt) }),
          el('span', { class: 'event-row__title', text: event.title }),
        ]),
      );
    }
  }

  if (detail.statusHistory.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Cambios de estado' }));
    for (const entry of detail.statusHistory) {
      refs.body.append(
        el('div', { class: 'event-row status-history-row' }, [
          el('span', { class: 'event-row__date', text: formatDate(entry.changedAt) }),
          el('span', { text: `${statusLabel(entry.toStatus)} · ${sourceLabel(entry.sourceId, detail.sources)}` }),
        ]),
      );
    }
  }

  if (detail.relations.length > 0) {
    refs.body.append(el('h3', { class: 'drawer-subtitle', text: 'Relaciones' }));
    for (const relation of detail.relations) {
      refs.body.append(
        el('div', { class: 'event-row' }, [
          el('span', { class: 'event-row__date', text: relation.type }),
          el('span', { text: relation.description ?? `${relation.fromProject} → ${relation.toProject}` }),
        ]),
      );
    }
  } else {
    refs.body.append(
      el('p', { class: 'empty-state', text: 'Sin relaciones verificadas: no se infieren relaciones sin fuente primaria.' }),
    );
  }
}