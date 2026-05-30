import { useCallback, useState } from 'react';

export function useNavigationHistory(initialUrl) {
  const [history, setHistory] = useState([initialUrl]);
  const [index, setIndex] = useState(0);

  const currentUrl = history[index];

  const navigate = useCallback(
    (url, { replace = false } = {}) => {
      if (!url || url === currentUrl) return;

      setHistory((prev) => {
        if (replace) {
          const next = [...prev];
          next[index] = url;
          return next;
        }
        const trimmed = prev.slice(0, index + 1);
        return [...trimmed, url];
      });

      if (!replace) {
        setIndex((i) => i + 1);
      }
    },
    [currentUrl, index]
  );

  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goForward = useCallback(() => {
    setIndex((i) => Math.min(history.length - 1, i + 1));
  }, [history.length]);

  const canGoBack = index > 0;
  const canGoForward = index < history.length - 1;

  return {
    currentUrl,
    navigate,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    setIndex,
    history,
  };
}
