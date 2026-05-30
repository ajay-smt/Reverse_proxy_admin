import { PROXY_BASE_COOKIE } from '../constants.js';

export function setProxyBaseCookie(res, targetUrl) {
  res.cookie(PROXY_BASE_COOKIE, targetUrl, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });
}

export function getProxyBaseFromCookie(req) {
  const value = req.cookies?.[PROXY_BASE_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function filterProxyCookies(cookieHeader) {
  if (!cookieHeader) return undefined;

  const filtered = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(`${PROXY_BASE_COOKIE}=`));

  return filtered.length > 0 ? filtered.join('; ') : undefined;
}
