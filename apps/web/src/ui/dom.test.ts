import { describe, expect, it } from 'vitest';
import { clear, el, svgEl } from './dom.ts';

describe('el', () => {
  it('sets attributes and skips null, undefined and false values', () => {
    const node = el('div', { id: 'x', 'aria-hidden': true, hidden: false, title: null, lang: undefined });
    expect(node.id).toBe('x');
    expect(node.hasAttribute('aria-hidden')).toBe(true);
    expect(node.getAttribute('aria-hidden')).toBe('');
    expect(node.hasAttribute('hidden')).toBe(false);
    expect(node.hasAttribute('title')).toBe(false);
  });

  it('inserts children and text without interpreting html', () => {
    const node = el('p', {}, [document.createTextNode('<img src=x onerror=alert(1)>')]);
    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('applies dataset entries', () => {
    const node = el('button', { dataset: { testid: 'go' } } as never);
    expect(node.getAttribute('data-testid')).toBe('go');
  });
});

describe('clear', () => {
  it('removes every child node', () => {
    const node = el('div', {}, [el('span'), el('span')]);
    clear(node);
    expect(node.childNodes).toHaveLength(0);
  });
});

describe('svgEl', () => {
  it('creates namespaced svg nodes', () => {
    const node = svgEl('path', { d: 'M0 0 L10 10' });
    expect(node.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(node.getAttribute('d')).toBe('M0 0 L10 10');
  });
});