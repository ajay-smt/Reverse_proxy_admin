import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { isApiPath, resolveUrl } from './url.js';
import { PROXY_PATH } from '../constants.js';

export function buildProxyUrl(targetUrl) {
  return `${config.proxyPublicUrl}${PROXY_PATH}?url=${encodeURIComponent(targetUrl)}`;
}

/**
 * Pages/assets → paths on local proxy (e.g. /assets/app.js)
 * API routes → full live URL (e.g. https://reverse-proxy-p1ne.onrender.com/api/users)
 */
export function toProxyPath(value, pageUrl) {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || /^(#|mailto:|tel:|javascript:|data:|blob:)/i.test(trimmed)) {
    return value;
  }

  const absolute = resolveUrl(pageUrl, trimmed);
  if (!absolute) return value;

  try {
    const pageOrigin = new URL(pageUrl).origin;
    const absUrl = new URL(absolute);

    if (absUrl.origin === pageOrigin) {
      if (isApiPath(absUrl.pathname)) {
        return absUrl.href;
      }
      return absUrl.pathname + absUrl.search + absUrl.hash;
    }
  } catch {
    return buildProxyUrl(absolute);
  }

  return buildProxyUrl(absolute);
}

const REWRITABLE_ATTRS = [
  'href',
  'src',
  'action',
  'data-src',
  'data-href',
  'poster',
  'srcset',
];

function rewriteSrcset(value, pageUrl) {
  return value
    .split(',')
    .map((part) => {
      const pieces = part.trim().split(/\s+/);
      if (!pieces[0]) return part;
      pieces[0] = toProxyPath(pieces[0], pageUrl);
      return pieces.join(' ');
    })
    .join(', ');
}

export function rewriteHtml(html, pageUrl) {
  const $ = cheerio.load(html, { decodeEntities: false });

  REWRITABLE_ATTRS.forEach((attr) => {
    $(`[${attr}]`).each((_, el) => {
      const value = $(el).attr(attr);
      if (!value) return;

      if (attr === 'srcset') {
        $(el).attr(attr, rewriteSrcset(value, pageUrl));
      } else {
        $(el).attr(attr, toProxyPath(value, pageUrl));
      }
    });
  });

  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();

  injectBridgeScript($, pageUrl);

  return $.html();
}

function prependBridgeToHead($, pageUrl) {
  const bridge = buildBridgeScript(pageUrl);
  if ($('head').length) {
    $('head').prepend(bridge);
  } else {
    $('html').prepend(`<head>${bridge}</head>`);
  }
}

function buildBridgeScript(pageUrl) {
  const targetOrigin = new URL(pageUrl).origin;
  const targetBase = pageUrl;
  const proxyOrigin = new URL(config.proxyPublicUrl).origin;

  return `<script id="__proxy-bridge">
(function() {
  var TARGET_ORIGIN = ${JSON.stringify(targetOrigin)};
  var TARGET_BASE = ${JSON.stringify(targetBase)};
  var PROXY_ORIGIN = ${JSON.stringify(proxyOrigin)};

  function pathToTarget() {
    return new URL(location.pathname + location.search + location.hash, TARGET_BASE).href;
  }

  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    var trimmed = url.trim();
    if (/^(#|mailto:|tel:|javascript:|data:|blob:)/i.test(trimmed)) return url;

    try {
      var abs = new URL(trimmed, TARGET_BASE);
      if (abs.origin === TARGET_ORIGIN) {
        if (abs.pathname.indexOf('/api') === 0) {
          return abs.href;
        }
        return abs.pathname + abs.search + abs.hash;
      }
      if (abs.origin === PROXY_ORIGIN) {
        if (abs.pathname === '/proxy') return abs.pathname + abs.search;
        return abs.pathname + abs.search + abs.hash;
      }
      return '/proxy?url=' + encodeURIComponent(abs.href) + '&redirect=0';
    } catch (e) {
      return url;
    }
  }

  function syncParentUrl() {
    try {
      window.parent.postMessage({ type: 'PROXY_URL_SYNC', url: pathToTarget() }, '*');
    } catch (e) {}
  }

  function isUsersSubmit(url, method) {
    try {
      var u = new URL(url, TARGET_BASE);
      return u.pathname === '/api/users' && String(method || 'GET').toUpperCase() === 'POST';
    } catch (e) {
      return false;
    }
  }

  var _fetch = window.fetch;

  function mirrorToProxyData(body) {
    if (!body || !_fetch) return;
    _fetch(PROXY_ORIGIN + '/internal/proxy-data/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Target': TARGET_BASE
      },
      body: typeof body === 'string' ? body : body
    }).catch(function() {});
  }

  if (_fetch) {
    window.fetch = function(input, init) {
      init = init || {};
      var rawUrl = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
      var method = init.method || (input instanceof Request ? input.method : 'GET');
      var rewritten = rewriteUrl(rawUrl);

      if (isUsersSubmit(rewritten, method) && init.body) {
        mirrorToProxyData(init.body);
      }

      if (typeof input === 'string') {
        input = rewritten;
      } else if (input instanceof Request) {
        input = new Request(rewritten, input);
      }
      return _fetch.call(this, input, init);
    };
  }

  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._proxyMethod = method;
    this._proxyUrl = rewriteUrl(url);
    arguments[1] = this._proxyUrl;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (isUsersSubmit(this._proxyUrl, this._proxyMethod)) {
      mirrorToProxyData(body);
    }
    return _send.apply(this, arguments);
  };

  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a || !a.href) return;
    if (a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    var rewritten = rewriteUrl(href);
    if (rewritten.charAt(0) === '/' && rewritten.indexOf('/proxy') !== 0) {
      return;
    }
    e.preventDefault();
    if (rewritten.indexOf('/proxy') === 0) {
      window.location.href = rewritten;
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || !form.action) return;
    form.action = rewriteUrl(form.getAttribute('action') || form.action);
  }, true);

  var _push = history.pushState.bind(history);
  history.pushState = function() {
    _push.apply(history, arguments);
    syncParentUrl();
  };
  var _replace = history.replaceState.bind(history);
  history.replaceState = function() {
    _replace.apply(history, arguments);
    syncParentUrl();
  };
  window.addEventListener('popstate', syncParentUrl);
  syncParentUrl();
})();
</script>`;
}

function injectBridgeScript($, pageUrl) {
  prependBridgeToHead($, pageUrl);
}

export function rewriteCss(css, pageUrl) {
  return css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (_match, quote, rawUrl) => {
      const rewritten = toProxyPath(rawUrl.trim(), pageUrl);
      return `url(${quote}${rewritten}${quote})`;
    }
  );
}

export function rewriteJs(js, pageUrl) {
  const patterns = [
    /(["'])(https?:\/\/[^"'\\]+)\1/g,
    /(["'])(\/[^"'\\]*)\1/g,
    /(`)(\/[^`\\]+)\1/g,
  ];

  let result = js;
  for (const pattern of patterns) {
    result = result.replace(pattern, (_full, quote, path) => {
      const rewritten = toProxyPath(path, pageUrl);
      return `${quote}${rewritten}${quote}`;
    });
  }
  return result;
}

export function rewriteBody(content, contentType, pageUrl) {
  if (!content || !pageUrl) return content;

  const type = (contentType || '').toLowerCase();

  if (type.includes('text/html')) {
    return rewriteHtml(content, pageUrl);
  }
  if (type.includes('text/css')) {
    return rewriteCss(content, pageUrl);
  }
  if (type.includes('javascript') || type.includes('ecmascript')) {
    return rewriteJs(content, pageUrl);
  }

  return content;
}
