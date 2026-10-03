import { el } from './dom.ts';
import { icon } from './icons.ts';
import type { ShellRefs } from './shell.ts';

export interface HeaderRefs {
  root: HTMLElement;
  breadcrumb: HTMLElement;
  search: HTMLInputElement;
  status: HTMLElement;
  railToggle: HTMLButtonElement;
}

export interface HeaderHandlers {
  onSearch: (value: string) => void;
  onRailToggle: () => void;
}

export function createHeader(refs: ShellRefs, handlers: HeaderHandlers): HeaderRefs {
  const wordmark = el('span', { class: 'wordmark', text: 'AI World Atlas' });

  const breadcrumb = el('nav', { class: 'breadcrumb', 'data-testid': 'breadcrumb', 'aria-label': 'Jerarquía' });

  const searchId = 'atlas-search';
  const searchInput = el('input', {
    id: searchId,
    type: 'search',
    placeholder: 'Buscar proyectos…',
    'data-testid': 'search-input',
    autocomplete: 'off',
    spellcheck: 'false',
  }) as HTMLInputElement;
  searchInput.addEventListener('input', () => {
    handlers.onSearch(searchInput.value);
  });

  const search = el('div', { class: 'search' }, [
    icon('search', 14),
    el('label', { for: searchId, class: 'visually-hidden', text: 'Buscar proyectos' }),
    searchInput,
  ]);

  const status = el('div', { class: 'status-badge', 'data-testid': 'api-status', role: 'status' });

  const railToggle = el('button', {
    type: 'button',
    class: 'icon-button',
    'aria-label': 'Mostrar u ocultar filtros',
    'data-testid': 'rail-toggle',
  }) as HTMLButtonElement;
  railToggle.append(icon('layers', 16));
  railToggle.addEventListener('click', () => handlers.onRailToggle());

  refs.header.append(wordmark, breadcrumb, search, status, railToggle);
  return { root: refs.header, breadcrumb, search: searchInput, status, railToggle };
}