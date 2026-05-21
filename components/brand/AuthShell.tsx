import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

// Reusable layout for auth pages (login, signup, forgot, reset).
// Theme-aware: light is default, dark via the toggle in the chat header
// (or system preference). Same chrome on both modes — only the surface
// colors flip.

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background dark:bg-[#0d0d0d] text-foreground dark:text-white font-outfit antialiased flex flex-col overflow-hidden">
      {/* Decorative cyan glow shapes — translucent cyan reads on both
          light and dark backgrounds. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 h-[28rem] w-[28rem] rounded-full bg-brand/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
      />

      {/* Header */}
      <header className="relative z-10 px-6 md:px-12 py-6">
        <Link
          href="/"
          className="inline-flex items-center"
          aria-label="2B Supply — voltar para a página inicial"
        >
          <BrandLogo size="md" priority />
        </Link>
      </header>

      {/* Centered card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl dark:shadow-2xl dark:shadow-black/40">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-xs text-muted-foreground text-center">
        ProcurementGPT · parte do ecossistema{' '}
        <a
          href="https://2bsupply.com.br/en/"
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-brand transition-colors"
        >
          2B Supply
        </a>
      </footer>
    </div>
  );
}
