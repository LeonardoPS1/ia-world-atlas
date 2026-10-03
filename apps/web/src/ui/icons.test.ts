import { describe, expect, it } from 'vitest';
import { icon } from './icons.ts';
import type { IconName } from './icons.ts';

const names: IconName[] = [
  'close', 'search', 'play', 'pause', 'back', 'chevron-left', 'chevron-right',
  'layers', 'link', 'target', 'filter', 'clock', 'globe',
];

describe('icon', () => {
  it('renders a decorative namespaced svg with no text content', () => {
    const svg = icon('search', 20);
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.textContent).toBe('');
    expect(svg.childNodes.length).toBeGreaterThan(0);
  });

  it('covers every declared icon name', () => {
    for (const name of names) {
      expect(icon(name).childNodes.length).toBeGreaterThan(0);
    }
  });
});