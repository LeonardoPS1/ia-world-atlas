import type { QueryValue } from './types.ts';

export function buildQueryString(params: Record<string, unknown>): string {
  const pairs: string[] = [];
  for (const key of Object.keys(params).sort()) {
    const value = params[key] as QueryValue | undefined;
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item === undefined || item === null || item === '') continue;
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
      }
      continue;
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}