export interface SafeUrlOptions {
  allowHttp?: boolean;
}

export function safeExternalUrl(url: string, options: SafeUrlOptions = {}): string | null {
  const candidate = url.trim();
  if (candidate.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.toString();
  if (parsed.protocol === 'http:' && options.allowHttp === true) return parsed.toString();
  return null;
}