import { useCallback, useEffect, useState } from 'react';
import ErrorScreen from './components/ErrorScreen.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import Navbar from './components/Navbar.jsx';
import ProxyFrame from './components/ProxyFrame.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import { useNavigationHistory } from './hooks/useNavigationHistory.js';
import { checkProxyHealth } from './services/api.js';
import { normalizeUrl } from './utils/url.js';

const DEFAULT_URL =
  import.meta.env.VITE_DEFAULT_TARGET_URL ||
  'https://reverse-proxy-p1ne.onrender.com/';

const LOAD_TIMEOUT_MS = 45000;

export default function App() {
  const {
    currentUrl,
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useNavigationHistory(DEFAULT_URL);

  const [urlInput, setUrlInput] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [backendOk, setBackendOk] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);

  useEffect(() => {
    setUrlInput(currentUrl);
    setIsLoading(true);
    setError(null);
  }, [currentUrl, reloadKey]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading((loading) => {
        if (loading) {
          setError({
            title: 'Request timed out',
            message: `Loading ${currentUrl} took too long. Try reload or another URL.`,
          });
          return false;
        }
        return loading;
      });
    }, LOAD_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [currentUrl, reloadKey, isLoading]);

  useEffect(() => {
    checkProxyHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  const handleNavigate = useCallback(
    (raw, options = {}) => {
      const normalized = normalizeUrl(raw);
      if (!normalized) {
        if (!options.syncOnly) {
          setError({
            title: 'Invalid URL',
            message: 'Enter a valid http or https address.',
          });
        }
        return;
      }

      if (options.syncOnly) {
        setUrlInput(normalized);
        return;
      }

      navigate(normalized);
    },
    [navigate]
  );

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const handleIframeError = useCallback(() => {
    setIsLoading(false);
    setError({
      title: 'Failed to load website',
      message: `Could not load ${currentUrl}. The site may block proxies, require authentication, or be unreachable.`,
    });
  }, [currentUrl]);

  const handleReload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  if (backendOk === false) {
    return (
      <div className="flex h-full flex-col">
        <ErrorScreen
          title="Backend unavailable"
          message="Start the proxy server on port 5000 (npm run dev in /backend), then refresh this page."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  if (showAdmin) {
    return <AdminDashboard onClose={() => setShowAdmin(false)} />;
  }

  return (
    <div className="flex h-full flex-col">
      <Navbar
        urlInput={urlInput}
        onUrlInputChange={setUrlInput}
        onNavigate={handleNavigate}
        onReload={handleReload}
        onBack={goBack}
        onForward={goForward}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        isLoading={isLoading}
        onOpenAdmin={() => setShowAdmin(true)}
      />

      <main className="relative min-h-0 flex-1">
        {isLoading && !error && (
          <div className="absolute inset-0 z-10">
            <LoadingSpinner />
          </div>
        )}

        {error ? (
          <ErrorScreen
            title={error.title}
            message={error.message}
            onRetry={handleRetry}
          />
        ) : (
          <ProxyFrame
            targetUrl={currentUrl}
            reloadKey={reloadKey}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            onNavigate={handleNavigate}
          />
        )}
      </main>
    </div>
  );
}
