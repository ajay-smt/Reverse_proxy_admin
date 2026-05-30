function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-surface-border hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export default function Navbar({
  urlInput,
  onUrlInputChange,
  onNavigate,
  onReload,
  onBack,
  onForward,
  canGoBack,
  canGoForward,
  isLoading,
  onOpenAdmin,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onNavigate(urlInput.trim());
  };

  return (
    <header className="flex shrink-0 flex-col gap-2 border-b border-surface-border bg-surface-raised px-3 py-2 sm:flex-row sm:items-center sm:gap-3 sm:px-4">
      <div className="flex items-center gap-1 sm:gap-2">
        <div className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg bg-accent-muted sm:mr-2">
          <svg className="h-4 w-4 text-accent" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
          </svg>
        </div>
        <span className="hidden text-sm font-semibold text-slate-200 sm:inline">Web Portal</span>

        <IconButton label="Go back" onClick={onBack} disabled={!canGoBack}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </IconButton>

        <IconButton label="Go forward" onClick={onForward} disabled={!canGoForward}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </IconButton>

        <IconButton label="Reload" onClick={onReload} disabled={isLoading}>
          <svg
            className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </IconButton>
      </div>

      <form onSubmit={handleSubmit} className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => onUrlInputChange(e.target.value)}
            placeholder="https://reverse-proxy-p1ne.onrender.com/"
            className="w-full rounded-lg border border-surface-border bg-surface py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-accent focus:ring-1 focus:ring-accent"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
        >
          Go
        </button>
        <button
          type="button"
          onClick={onOpenAdmin}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500 active:scale-95"
        >
          Admin Console
        </button>
      </form>
    </header>
  );
}
