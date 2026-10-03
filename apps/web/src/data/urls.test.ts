import { describe, expect, it } from 'vitest';
import { safeExternalUrl } from './urls.ts';

describe('safeExternalUrl', () => {
  it('accepts https', () => {
    expect(safeExternalUrl('https://example.org/a')).toBe('https://example.org/a');
  });

  it('accepts http only when explicitly allowed', () => {
    expect(safeExternalUrl('http://localhost:3000/a', { allowHttp: true })).toBe('http://localhost:3000/a');
    expect(safeExternalUrl('http://example.org/a')).toBeNull();
  });

  it('rejects javascript, data and vbscript schemes', () => {
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull();
    expect(safeExternalUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeExternalUrl('data:text/html,<script>x</script>')).toBeNull();
    expect(safeExternalUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('rejects relative and malformed values', () => {
    expect(safeExternalUrl('/relative/path')).toBeNull();
    expect(safeExternalUrl('not a url')).toBeNull();
    expect(safeExternalUrl('')).toBeNull();
  });
});