export function unwrapProxyUrl(maybeProxyUrl) {
  try {
    const parsed = new URL(maybeProxyUrl);
    const nested = parsed.searchParams.get('url');
    if (nested && parsed.pathname.replace(/\/$/, '') === '/proxy') {
      return nested;
    }
  } catch {
    /* not a URL */
  }
  return maybeProxyUrl;
}

export function normalizeUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
