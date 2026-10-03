import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { boot } from './app/boot.ts';
import { createApiClient } from './data/client.ts';
import { el } from './ui/dom.ts';

function readFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === 'true' || value === '1';
}

const container = document.querySelector<HTMLElement>('#app');
if (!container) {
  throw new Error('Missing #app root element');
}

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

try {
  const client = createApiClient(baseUrl);
  boot({
    container,
    client,
    allowHttpSources: readFlag(import.meta.env.VITE_ALLOW_HTTP_SOURCES, import.meta.env.DEV),
  });
} catch (error) {
  container.append(
    el('div', { class: 'boot-error' }, [
      el('h1', { text: 'AI World Atlas no pudo iniciar' }),
      el('p', { text: error instanceof Error ? error.message : 'Error desconocido' }),
      el('p', { text: `Verificá que la API esté disponible en ${baseUrl}.` }),
    ]),
  );
}