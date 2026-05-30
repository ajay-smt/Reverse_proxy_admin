import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from '../config.js';
import { stripFrameBlockingHeaders, rewriteLocationHeader, rewriteSetCookieHeaders, setProxyBaseCookieHeader } from '../middleware/security.js';
import { filterProxyCookies } from '../utils/cookies.js';
import { rewriteBody } from '../utils/rewrite.js';
import { resolveTargetUrl } from '../utils/target.js';

const REWRITABLE_TYPES = [
  'text/html',
  'text/css',
];

function shouldRewriteResponse(contentType) {
  if (!contentType) return false;
  const type = contentType.toLowerCase();
  if (type.includes('application/json')) return false;
  return REWRITABLE_TYPES.some((t) => type.includes(t));
}

function collectAndRewrite(proxyRes, req, res, targetUrl) {
  const contentType = proxyRes.headers['content-type'] || '';
  const statusCode = proxyRes.statusCode || 200;
  const chunks = [];
  let totalSize = 0;

  proxyRes.on('data', (chunk) => {
    totalSize += chunk.length;
    chunks.push(chunk);
  });

  proxyRes.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);

      if (totalSize > config.maxRewriteBytes || !shouldRewriteResponse(contentType)) {
        res.writeHead(statusCode, proxyRes.headers);
        res.end(buffer);
        return;
      }

      const body = buffer.toString('utf8');
      const rewritten = rewriteBody(body, contentType, targetUrl);
      const headers = { ...proxyRes.headers };
      delete headers['content-length'];
      delete headers['content-encoding'];
      headers['content-length'] = Buffer.byteLength(rewritten, 'utf8');

      res.writeHead(statusCode, headers);
      res.end(rewritten);
    } catch (err) {
      console.error('[proxy] rewrite error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Failed to process proxied response',
          message: err.message,
        });
      }
    }
  });
}

export function attachTargetUrl(req, res, next) {
  req._proxyTargetUrl = resolveTargetUrl(req);
  next();
}

export const proxyMiddleware = createProxyMiddleware({
  changeOrigin: true,
  ws: true,
  secure: true,
  followRedirects: false,
  timeout: config.proxyTimeoutMs,
  proxyTimeout: config.proxyTimeoutMs,
  selfHandleResponse: true,

  router(req) {
    const targetUrl = req._proxyTargetUrl || resolveTargetUrl(req);
    if (!targetUrl) return config.proxyPublicUrl;
    const parsed = new URL(targetUrl);
    return `${parsed.protocol}//${parsed.host}`;
  },

  pathRewrite(_path, req) {
    const targetUrl = req._proxyTargetUrl || resolveTargetUrl(req);
    if (!targetUrl) return '/';
    const parsed = new URL(targetUrl);
    return parsed.pathname + parsed.search;
  },

  on: {
    proxyReq(proxyReq, req) {
      const targetUrl = req._proxyTargetUrl || resolveTargetUrl(req);
      if (!targetUrl) return;

      proxyReq.setHeader('Accept-Encoding', 'identity');

      const forwarded = filterProxyCookies(req.headers.cookie);
      if (forwarded) {
        proxyReq.setHeader('Cookie', forwarded);
      }

      proxyReq.setHeader(
        'User-Agent',
        req.headers['user-agent'] || 'Mozilla/5.0 (compatible; ReverseProxy/1.0)'
      );
      proxyReq.setHeader('Referer', targetUrl);

      if (req.headers.origin) {
        try {
          const targetOrigin = new URL(targetUrl).origin;
          proxyReq.setHeader('Origin', targetOrigin);
        } catch (e) {}
      }
    },

    proxyRes(proxyRes, req, res) {
      const targetUrl = req._proxyTargetUrl || resolveTargetUrl(req);
      if (!targetUrl) {
        res.status(400).json({ error: 'Missing proxy target' });
        return;
      }

      const accept = req.headers.accept || '';
      const isProxyEntry = req.path === '/proxy' || req.path.startsWith('/proxy/');
      if (isProxyEntry || accept.includes('text/html')) {
        setProxyBaseCookieHeader(proxyRes, targetUrl);
      }
      stripFrameBlockingHeaders(proxyRes);
      rewriteLocationHeader(proxyRes, targetUrl);
      rewriteSetCookieHeaders(proxyRes);

      if (req.method === 'HEAD') {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        res.end();
        return;
      }

      collectAndRewrite(proxyRes, req, res, targetUrl);
    },

    error(err, _req, res) {
      console.error('[proxy] error:', err.message);
      if (res && typeof res.status === 'function' && !res.headersSent) {
        res.status(502).json({
          error: 'Proxy request failed',
          message: err.message,
        });
      }
    },
  },
});
