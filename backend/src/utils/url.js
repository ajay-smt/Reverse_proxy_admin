import { URL } from 'url';

export function isValidHttpUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

export function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isHostAllowed(hostname, allowedHosts) {
  if (!allowedHosts.length) return true;
  const host = hostname.toLowerCase();
  return allowedHosts.some((allowed) => {
    const pattern = allowed.toLowerCase();
    return host === pattern || host.endsWith(`.${pattern}`);
  });
}

/** API routes call the live target origin directly (e.g. /api/users → https://site.com/api/users) */
export function isApiPath(pathname) {
  return typeof pathname === 'string' && pathname.startsWith('/api');
}
