import { describe, expect, it, vi } from 'vitest';
import { createHeader } from './header.ts';
import { createShell } from './shell.ts';
import { renderBreadcrumb } from './breadcrumb.ts';

describe('createHeader', () => {
  function setup() {
    const refs = createShell(document.createElement('div'));
    const onSearch = vi.fn();
    const onRailToggle = vi.fn();
    const header = createHeader(refs, { onSearch, onRailToggle });
    return { header, onSearch, onRailToggle };
  }

  it('exposes the wordmark, breadcrumb, search and status', () => {
    const { header } = setup();
    expect(header.root.querySelector('.wordmark')?.textContent).toBe('AI World Atlas');
    expect(header.breadcrumb.getAttribute('data-testid')).toBe('breadcrumb');
    expect(header.search.getAttribute('data-testid')).toBe('search-input');
    expect(header.status.getAttribute('data-testid')).toBe('api-status');
  });

  it('emits the debounced value on input, not on every keystroke', () => {
    const { header, onSearch } = setup();
    header.search.value = 'po';
    header.search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('labels the search input for screen readers', () => {
    const { header } = setup();
    const label = header.root.querySelector('label[for="atlas-search"]');
    expect(label).not.toBeNull();
    expect(header.search.id).toBe('atlas-search');
  });

  it('toggles the rail from a labelled button', () => {
    const { header, onRailToggle } = setup();
    expect(header.railToggle.getAttribute('aria-label')).toBeTruthy();
    header.railToggle.click();
    expect(onRailToggle).toHaveBeenCalledTimes(1);
  });
});

describe('renderBreadcrumb', () => {
  it('renders one button per level plus a world reset', () => {
    const host = document.createElement('nav');
    const onFocus = vi.fn();
    renderBreadcrumb(host, [], onFocus);
    expect(host.querySelectorAll('button').length).toBe(1);
    expect(host.querySelector('button')?.textContent).toBe('Mundo');
  });

  it('marks the deepest crumb as current and keeps the rest navigable', () => {
    const host = document.createElement('nav');
    const onFocus = vi.fn();
    renderBreadcrumb(
      host,
      [
        { id: 'world', name: 'Mundo', level: 'WORLD', parentId: null, countryCode: null, longitude: 0, latitude: 0, childCount: 0, projectCount: 0, metadata: {} },
        { id: 'chile', name: 'Chile', level: 'COUNTRY', parentId: 'world', countryCode: 'CL', longitude: -71, latitude: -33, childCount: 0, projectCount: 0, metadata: {} },
      ],
      onFocus,
    );
    const buttons = [...host.querySelectorAll('button')];
    expect(buttons.at(-1)?.getAttribute('aria-current')).toBe('true');
    buttons[0]?.click();
    expect(onFocus).toHaveBeenCalledWith('world');
  });

  it('never inserts raw html', () => {
    const host = document.createElement('nav');
    const onFocus = vi.fn();
    renderBreadcrumb(
      host,
      [
        {
          id: 'x',
          name: '<img src=x onerror=alert(1)>',
          level: 'COUNTRY',
          parentId: null,
          countryCode: null,
          longitude: 0,
          latitude: 0,
          childCount: 0,
          projectCount: 0,
          metadata: {},
        },
      ],
      onFocus,
    );
    expect(host.querySelector('img')).toBeNull();
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});