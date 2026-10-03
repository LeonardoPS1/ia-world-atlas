import { clear, el } from './dom.ts';
import type { AtlasState } from '../state/store.ts';

type BadgeState = Pick<AtlasState, 'apiStatus' | 'apiError' | 'globalTotal' | 'matchingTotal' | 'lastRequestId'>;

const LABELS: Record<BadgeState['apiStatus'], string> = {
  idle: 'Preparando…',
  loading: 'Cargando…',
  ok: 'Conexión estable',
  error: 'Sin conexión',
};

function firstLine(message: string | null): string | null {
  if (message === null) return null;
  const line = message.split('\n')[0]?.trim();
  return line && line.length > 0 ? line.slice(0, 120) : null;
}

export function renderStatusBadge(node: HTMLElement, state: BadgeState): void {
  clear(node);
  node.setAttribute('data-state', state.apiStatus);
  node.append(el('span', { class: 'status-badge__dot', 'aria-hidden': 'true' }));
  node.append(el('span', { class: 'status-badge__text', text: LABELS[state.apiStatus] }));

  if (state.apiStatus === 'ok') {
    node.append(
      el('span', { class: 'counts' }, [
        el('span', { class: 'counts__primary', 'data-testid': 'matching-count', text: String(state.matchingTotal) }),
        el('span', { class: 'counts__secondary', text: 'de' }),
        el('span', { class: 'counts__secondary', 'data-testid': 'global-total', text: String(state.globalTotal) }),
      ]),
    );
  }

  if (state.apiStatus === 'error') {
    const detail = firstLine(state.apiError);
    if (detail) node.append(el('span', { class: 'status-badge__detail', text: detail }));
    if (state.lastRequestId) {
      node.append(el('span', { class: 'status-badge__detail', text: `ref ${state.lastRequestId}` }));
    }
  }
}