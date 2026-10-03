export interface MapDiagnostics {
  ok: boolean;
  token: string | null;
  tokenPresent: boolean;
  webglAvailable: boolean;
  constructorError: string | null;
  styleLoadError: string | null;
  mode: 'globe' | 'fallback';
  reason: string | null;
}

function hasWebgl(documentRef: Document): boolean {
  try {
    const canvas = documentRef.createElement('canvas');
    return (
      canvas.getContext('webgl2') !== null ||
      canvas.getContext('webgl') !== null
    );
  } catch {
    return false;
  }
}

export function diagnoseMapEnvironment(options: {
  token: string | undefined;
  documentRef?: Document;
  windowRef?: Window;
}): MapDiagnostics {
  const documentRef = options.documentRef ?? globalThis.document;
  const tokenPresent = typeof options.token === 'string' && options.token.trim().length > 0;
  const webglAvailable = hasWebgl(documentRef);

  if (!tokenPresent) {
    return {
      ok: false,
      token: options.token ?? null,
      tokenPresent: false,
      webglAvailable,
      constructorError: null,
      styleLoadError: null,
      mode: 'fallback',
      reason: 'Mapbox token missing (VITE_MAPBOX_TOKEN)',
    };
  }
  if (!webglAvailable) {
    return {
      ok: false,
      token: options.token ?? null,
      tokenPresent: true,
      webglAvailable: false,
      constructorError: null,
      styleLoadError: null,
      mode: 'fallback',
      reason: 'WebGL unavailable in this browser',
    };
  }
  return {
    ok: true,
    token: options.token ?? null,
    tokenPresent: true,
    webglAvailable: true,
    constructorError: null,
    styleLoadError: null,
    mode: 'globe',
    reason: null,
  };
}