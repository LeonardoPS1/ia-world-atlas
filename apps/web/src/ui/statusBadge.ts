import { clear, el } from './dom.ts';
import type { AtlasState } from '../state/store.ts';

type BadgeState = Pick<AtlasState, 'api' | 'globalTotal' | 'matchingTotal' | 'lastRequestId'>;

const LABELS: Record<BadgeState['api']['status'], string> = {
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

export function renderStatusBadge(node: HTMLElement, api: AtlasState['api'], lastRequestId: string | null, matchingTotal: number, globalTotal: number): void {
  clear(node);
  node.setAttribute('data-state', api.status);
  node.append(el('span', { class: 'status-badge__dot', 'aria-hidden': 'true' }));
  node.append(el('span', { class: 'status-badge__text', text: LABELS[api.status] }));

  if (api.status === 'ok') {
    node.append(
      el('span', { class: 'counts' }, [
        el('span', { class: 'counts__primary', 'data-testid': 'matching-count', text: String(matchingTotal) }),
        el('span', { class: 'counts__secondary', text: 'de' }),
        el('span', { class: 'counts__secondary', 'data-testid': 'global-total', text: String(globalTotal) }),
      ]),
    );
  }

  if (api.status === 'error') {
    const detail = firstLine(api.detail);
    if (detail) node.append(el('span', { class: 'status-badge__detail', text: detail }));
    if (lastRequestId) {
      node.append(el('span', { class: 'status-badge__detail', text: `ref ${lastRequestId}` }));
    }
  }
}