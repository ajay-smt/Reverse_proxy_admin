import express from 'express';
import { attachTargetUrl, proxyMiddleware } from '../proxy/engine.js';
import { setProxyBaseCookie } from '../utils/cookies.js';
import { isReservedPath, validateTarget, resolveTargetUrl } from '../utils/target.js';

const router = express.Router();

function wantsHtmlRedirect(req) {
  if (req.method !== 'GET') return false;
  const accept = req.headers.accept || '';
  // Must explicitly ask for text/html and not be an image, stylesheet, or script asset
  return (
    accept.includes('text/html') &&
    !accept.includes('image/') &&
    !accept.includes('text/css') &&
    !accept.includes('application/javascript')
  );
}

router.get('/proxy', attachTargetUrl, (req, res, next) => {
  const targetUrl = req._proxyTargetUrl;
  const validation = validateTarget(targetUrl);

  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.message });
  }

  if (wantsHtmlRedirect(req) && req.query.redirect !== '0') {
    const nextPath = new URL(targetUrl).pathname || '/';
    return res.redirect(302, nextPath);
  }

  proxyMiddleware(req, res, next);
});

router.use('/proxy', attachTargetUrl, (req, res, next) => {
  const targetUrl = req._proxyTargetUrl;
  const validation = validateTarget(targetUrl);

  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.message });
  }

  proxyMiddleware(req, res, next);
});

router.use(attachTargetUrl, (req, res, next) => {
  if (isReservedPath(req.path)) {
    return next();
  }

  const targetUrl = resolveTargetUrl(req);
  if (!targetUrl) {
    return next();
  }

  const validation = validateTarget(targetUrl);
  if (!validation.ok) {
    return res.status(validation.status).json({ error: validation.message });
  }

  req._proxyTargetUrl = targetUrl;
  proxyMiddleware(req, res, next);
});

export default router;
