import { describe, expect, it } from 'vitest';
import { renderStatusBadge } from './statusBadge.ts';

function render(state: Parameters<typeof renderStatusBadge>[1]) {
  const node = document.createElement('div');
  renderStatusBadge(node, state);
  return node;
}

describe('renderStatusBadge', () => {
  it('shows a loading state', () => {
    const node = render({ apiStatus: 'loading', apiError: null, globalTotal: 0, matchingTotal: 0, lastRequestId: null });
    expect(node.getAttribute('data-state')).toBe('loading');
    expect(node.textContent).toContain('Cargando');
  });

  it('shows the matching and global counts when connected', () => {
    const node = render({ apiStatus: 'ok', apiError: null, globalTotal: 5, matchingTotal: 2, lastRequestId: null });
    expect(node.getAttribute('data-state')).toBe('ok');
    expect(node.querySelector('[data-testid="matching-count"]')?.textContent).toBe('2');
    expect(node.querySelector('[data-testid="global-total"]')?.textContent).toBe('5');
  });

  it('surfaces the requestId on failure so a bug is reportable', () => {
    const node = render({
      apiStatus: 'error',
      apiError: 'Invalid request',
      globalTotal: 0,
      matchingTotal: 0,
      lastRequestId: 'req-42',
    });
    expect(node.getAttribute('data-state')).toBe('error');
    expect(node.textContent).toContain('req-42');
  });

  it('never renders a stack trace even if the error text contains one', () => {
    const node = render({
      apiStatus: 'error',
      apiError: 'Error: boom\n    at Object.<anonymous> (app.ts:1:1)',
      globalTotal: 0,
      matchingTotal: 0,
      lastRequestId: 'req-1',
    });
    expect(node.textContent).not.toContain('at Object');
  });
});