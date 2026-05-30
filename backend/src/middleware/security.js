import { resolveUrl } from '../utils/url.js';
import { toProxyPath } from '../utils/rewrite.js';

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
