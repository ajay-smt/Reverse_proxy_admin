import { useEffect, useRef } from 'react';
import { buildProxyUrl } from '../services/api.js';
import { unwrapProxyUrl } from '../utils/url.js';

export default function ProxyFrame({
  targetUrl,
  reloadKey,
  onLoad,
  onError,
  onNavigate,
}) {
  const iframeRef = useRef(null);
  const proxySrc = buildProxyUrl(targetUrl);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'PROXY_URL_SYNC') {
        onNavigate?.(event.data.url, { syncOnly: true });
        return;
      }
      if (event.data?.type !== 'PROXY_NAVIGATE') return;
      const raw = event.data.url;
      const url = unwrapProxyUrl(raw);
      if (url && url !== targetUrl) {
        onNavigate(url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNavigate, targetUrl]);

  return (
    <iframe
      key={`${proxySrc}-${reloadKey}`}
      ref={iframeRef}
      src={proxySrc}
      title="Proxied website"
      className="h-full w-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
      onLoad={onLoad}
      onError={onError}
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
