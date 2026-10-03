import { describe, expect, it } from 'vitest';
import { createShell } from './shell.ts';

describe('createShell', () => {
  it('creates the six regions with their test hooks', () => {
    const host = document.createElement('div');
    const refs = createShell(host);
    expect(host.querySelector('[data-testid="app-root"]')).toBe(refs.root);
    expect(refs.root.classList.contains('atlas')).toBe(true);
    for (const key of ['header', 'rail', 'map', 'drawer', 'strip'] as const) {
      expect(refs[key].parentElement).not.toBeNull();
    }
    expect(refs.map.getAttribute('data-testid')).toBe('map-host');
  });

  it('starts with the rail open and the drawer closed', () => {
    const refs = createShell(document.createElement('div'));
    expect(refs.rail.hasAttribute('hidden')).toBe(false);
    expect(refs.drawer.hasAttribute('hidden')).toBe(true);
  });

  it('exposes the drawer and rail as named landmarks for assistive tech', () => {
    const refs = createShell(document.createElement('div'));
    expect(refs.rail.getAttribute('aria-label')).toBeTruthy();
    expect(refs.drawer.getAttribute('aria-label')).toBeTruthy();
    expect(refs.map.getAttribute('role')).toBe('region');
  });
});