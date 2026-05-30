export default function LoadingSpinner({ message = 'Loading website…' }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-surface">
      <div
        className="h-12 w-12 animate-spin-slow rounded-full border-4 border-surface-border border-t-accent"
        role="status"
        aria-label="Loading"
      />
      <p className="text-sm font-medium text-slate-400">{message}</p>
    </div>
  );
}
