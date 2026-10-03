import { describe, expect, it } from 'vitest';
import { renderStatusBadge } from './statusBadge.ts';

function render(api: { status: 'idle' | 'loading' | 'ok' | 'error'; detail: string | null }, lastRequestId: string | null, matchingTotal: number, globalTotal: number) {
  const node = document.createElement('div');
  renderStatusBadge(node, api, lastRequestId, matchingTotal, globalTotal);
  return node;
}

describe('renderStatusBadge', () => {
  it('shows a loading state', () => {
    const node = render({ status: 'loading', detail: null }, null, 0, 0);
    expect(node.getAttribute('data-state')).toBe('loading');
    expect(node.textContent).toContain('Cargando');
  });

  it('shows the matching and global counts when connected', () => {
    const node = render({ status: 'ok', detail: null }, null, 2, 5);
    expect(node.getAttribute('data-state')).toBe('ok');
    expect(node.querySelector('[data-testid="matching-count"]')?.textContent).toBe('2');
    expect(node.querySelector('[data-testid="global-total"]')?.textContent).toBe('5');
  });

  it('surfaces the requestId on failure so a bug is reportable', () => {
    const node = render({ status: 'error', detail: 'Invalid request' }, 'req-42', 0, 0);
    expect(node.getAttribute('data-state')).toBe('error');
    expect(node.textContent).toContain('req-42');
  });

  it('never renders a stack trace even if the error text contains one', () => {
    const node = render({ status: 'error', detail: 'Error: boom\n    at Object.<anonymous> (app.ts:1:1)' }, 'req-1', 0, 0);
    expect(node.textContent).not.toContain('at Object');
  });
});