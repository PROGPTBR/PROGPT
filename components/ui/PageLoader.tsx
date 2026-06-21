// Branded loading indicator used as the Suspense fallback (loading.tsx) for
// route segments, so navigations to pages that fetch data feel fluid instead
// of frozen. A spinning ring with the brand accent + optional label.

type Props = {
  label?: string;
  /** When true, fills the whole viewport (used by full-screen segments). */
  fullScreen?: boolean;
};

export function PageLoader({ label = 'Carregando…', fullScreen = false }: Props) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 ${
        fullScreen ? 'h-screen' : 'min-h-[60vh]'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-2 border-border" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brand animate-spin" />
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
