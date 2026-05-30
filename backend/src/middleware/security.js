import { resolveUrl } from '../utils/url.js';
import { toProxyPath } from '../utils/rewrite.js';
import { config } from '../config.js';

const STRIP_RESPONSE_HEADERS = [
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
];

export function stripFrameBlockingHeaders(proxyRes) {
  for (const header of STRIP_RESPONSE_HEADERS) {
    delete proxyRes.headers[header];
  }
}

export function rewriteLocationHeader(proxyRes, targetUrl) {
  const location = proxyRes.headers['location'];
  if (!location) return;

  const absolute = resolveUrl(targetUrl, location);
  if (absolute) {
    proxyRes.headers['location'] = toProxyPath(absolute, targetUrl);
  }
}

export function rewriteSetCookieHeaders(proxyRes) {
  const setCookie = proxyRes.headers['set-cookie'];
  if (!setCookie) return;

  const rewriteCookie = (cookieStr) => {
    return cookieStr
      .split(';')
      .map((part) => {
        const trimmed = part.trim();
        const lower = trimmed.toLowerCase();
        
        // Strip out the Domain restriction so it binds to our proxy host
        if (lower.startsWith('domain=')) {
          return null;
        }
        
        // Strip out Secure attribute if testing locally on non-HTTPS HTTP
        if (lower === 'secure' && config.nodeEnv === 'development') {
          return null;
        }
        
        return trimmed;
      })
      .filter(Boolean)
      .join('; ');
  };

  if (Array.isArray(setCookie)) {
    proxyRes.headers['set-cookie'] = setCookie.map(rewriteCookie);
  } else if (typeof setCookie === 'string') {
    proxyRes.headers['set-cookie'] = rewriteCookie(setCookie);
  }
}

export function setProxyBaseCookieHeader(proxyRes, targetUrl) {
  const cookieValue = `__proxy_base=${encodeURIComponent(targetUrl)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
  
  const existing = proxyRes.headers['set-cookie'];
  if (!existing) {
    proxyRes.headers['set-cookie'] = [cookieValue];
  } else if (Array.isArray(existing)) {
    existing.push(cookieValue);
  } else if (typeof existing === 'string') {
    proxyRes.headers['set-cookie'] = [existing, cookieValue];
  }
}
