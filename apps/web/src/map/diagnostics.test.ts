import { describe, expect, it } from 'vitest';
import { diagnoseMapEnvironment } from './diagnostics.ts';

function fakeWindow(_webgl: boolean) {
  return {
    devicePixelRatio: 1,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
  } as unknown as Window & typeof globalThis;
}

function fakeDocumentWithWebgl(webglAvailable: boolean = true) {
  return {
    createElement: () => ({
      getContext: (kind: string) => (kind === 'webgl2' || kind === 'webgl' ? (webglAvailable ? {} : null) : null),
    }),
  } as unknown as Document;
}

describe('diagnoseMapEnvironment', () => {
  it('reports globe when a token exists and webgl works', () => {
    const result = diagnoseMapEnvironment({
      token: 'pk.test',
      documentRef: fakeDocumentWithWebgl(true),
      windowRef: fakeWindow(true),
    });
    expect(result.tokenPresent).toBe(true);
    expect(result.webglAvailable).toBe(true);
    expect(result.mode).toBe('globe');
    expect(result.reason).toBeNull();
  });

  it('falls back with a readable reason when the token is missing', () => {
    const result = diagnoseMapEnvironment({
      token: undefined,
      documentRef: fakeDocumentWithWebgl(true),
      windowRef: fakeWindow(true),
    });
    expect(result.tokenPresent).toBe(false);
    expect(result.mode).toBe('fallback');
    expect(result.reason).toBeTruthy();
  });

  it('falls back when webgl is unavailable', () => {
    const result = diagnoseMapEnvironment({
      token: 'pk.test',
      documentRef: {
        createElement: () => ({ getContext: () => null }),
      } as unknown as Document,
      windowRef: fakeWindow(false),
    });
    expect(result.webglAvailable).toBe(false);
    expect(result.mode).toBe('fallback');
  });

  it('never throws, whatever the environment', () => {
    const result = diagnoseMapEnvironment({
      token: '',
      documentRef: {
        createElement: () => {
          throw new Error('no dom');
        },
      } as unknown as Document,
      windowRef: fakeWindow(true),
    });
    expect(result.mode).toBe('fallback');
  });
});