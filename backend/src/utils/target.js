import { getProxyBaseFromCookie } from './cookies.js';
import { getHostname, isHostAllowed, isValidHttpUrl } from './url.js';
import { config } from '../config.js';

export function getTargetFromQuery(req) {
  const raw = req.query?.url;
  if (typeof raw === 'string' && isValidHttpUrl(raw)) {
    return raw;
  }
  return null;
}

export function getTargetFromPath(req) {
  const base = getProxyBaseFromCookie(req);
  if (!base || !isValidHttpUrl(base)) return null;

  try {
    const resolved = new URL(req.originalUrl, base);
    return resolved.href;
  } catch {
    return null;
  }
}

export function getTargetFromReferer(req) {
  const referer = req.headers['referer'] || req.headers['Referer'];
  if (!referer) return null;

  try {
    const parsedReferer = new URL(referer);
    if (parsedReferer.pathname === '/proxy' || parsedReferer.pathname.startsWith('/proxy/')) {
      const urlParam = parsedReferer.searchParams.get('url');
      if (urlParam && isValidHttpUrl(urlParam)) {
        return urlParam;
      }
    }
  } catch (e) {}
  return null;
}

export function resolveTargetUrl(req) {
  return getTargetFromQuery(req) || getTargetFromPath(req) || getTargetFromReferer(req);
}

export function validateTarget(url) {
  if (!url) {
    return { ok: false, status: 400, message: 'Invalid or missing target URL' };
  }

  const hostname = getHostname(url);
  if (!hostname) {
    return { ok: false, status: 400, message: 'Could not parse target hostname' };
  }

  if (!isHostAllowed(hostname, config.allowedHosts)) {
    return { ok: false, status: 403, message: `Host not allowed: ${hostname}` };
  }

  return { ok: true };
}

export function isReservedPath(pathname) {
  return (
    pathname === '/health' ||
    pathname === '/proxy' ||
    pathname.startsWith('/proxy/') ||
    pathname.startsWith('/internal/')
  );
}
