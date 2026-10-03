import { describe, expect, it, vi } from 'vitest';
import { createDrawer, renderDrawer } from './drawer.ts';
import { createShell } from './shell.ts';
import { projectDetailFixture } from '../testing/fixtures.ts';

function setup() {
  const refs = createShell(document.createElement('div'));
  const handlers = { onClose: vi.fn(), onFocus: vi.fn() };
  return { refs, drawer: createDrawer(refs.drawer, handlers), handlers };
}

describe('drawer', () => {
  it('renders the title, the metadata grid and the sources', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(drawer.title.getAttribute('data-testid')).toBe('drawer-title');
    expect(drawer.title.textContent).toBe('Politica Nacional de Inteligencia Artificial');
    expect(drawer.body.querySelector('.meta-grid')).not.toBeNull();
    expect(drawer.body.querySelectorAll('.source-card').length).toBeGreaterThan(0);
  });

  it('links only safe https sources', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    for (const link of drawer.body.querySelectorAll('a[data-testid="source-link"]')) {
      expect(link.getAttribute('href')?.startsWith('https://')).toBe(true);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
  });

  it('renders an unsafe source as unlinked text instead of a javascript href', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        sources: [
          { id: 's1', name: 'Documento', url: 'javascript:alert(1)', sourceType: 'GOVERNMENT', publicationDate: '2024-03-01', lastVerifiedAt: '2026-09-25T00:00:00.000Z', confidence: 'HIGH', snippet: 'test', isPrimary: true },
        ],
      },
      { allowHttp: false },
    );
    const text = drawer.body.querySelector('[data-testid="source-text"]');
    expect(text).not.toBeNull();
    expect(drawer.body.querySelector('[data-testid="source-link"]')).toBeNull();
    expect(drawer.body.innerHTML).not.toContain('javascript:alert(1)"');
  });

  it('allows http only when the environment explicitly permits it', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        sources: [
          { id: 's1', name: 'Local', url: 'http://localhost:3000/x', sourceType: 'ORGANIZATION', publicationDate: null, lastVerifiedAt: '2026-09-25T00:00:00.000Z', confidence: 'HIGH', snippet: 'test', isPrimary: false },
        ],
      },
      { allowHttp: true },
    );
    expect(drawer.body.querySelector('[data-testid="source-link"]')?.getAttribute('href')).toBe(
      'http://localhost:3000/x',
    );
  });

  it('renders the timeline events and the status history', () => {
    const { drawer } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(drawer.body.querySelectorAll('.event-row').length).toBe(2);
    // Fixture has empty statusHistory; renderDrawer only renders .status-history-row for non-empty history
    expect(drawer.body.querySelectorAll('.status-history-row').length).toBe(0);
  });

  it('renders an empty state instead of a blank panel', () => {
    const { drawer } = setup();
    renderDrawer(drawer, null, { allowHttp: false });
    expect(drawer.body.querySelector('.empty-state')).not.toBeNull();
  });

  it('shows and hides the panel through the hidden attribute', () => {
    const { refs, drawer, handlers } = setup();
    renderDrawer(drawer, projectDetailFixture, { allowHttp: false });
    expect(refs.drawer.hasAttribute('hidden')).toBe(false);
    drawer.close.click();
    expect(handlers.onClose).toHaveBeenCalled();
  });

  it('never uses innerHTML', () => {
    const { drawer } = setup();
    renderDrawer(
      drawer,
      {
        ...projectDetailFixture,
        name: '<img src=x onerror=alert(1)>',
        summary: '<script>alert(2)</script>',
      },
      { allowHttp: false },
    );
    expect(drawer.body.querySelector('img')).toBeNull();
    expect(drawer.body.querySelector('script')).toBeNull();
  });
});