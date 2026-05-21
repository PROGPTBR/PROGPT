import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

// Reusable layout for auth pages (login, signup, forgot, reset).
// Dark atmospheric chrome with 2B Supply logo + brand cyan accents.
// Mirrors the landing's tone so the transition from `/` → `/login` feels
// continuous. The form itself (the children) provides its own title +
// fields styled with the brand input/button utilities used across the
// auth components.

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#0d0d0d] text-white font-outfit antialiased flex flex-col overflow-hidden">
      {/* Decorative cyan glow shapes (Material You signature, dialed down). */}
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
        <Link href="/" className="inline-flex items-center" aria-label="2B Supply — voltar para a página inicial">
          <BrandLogo size="md" priority />
        </Link>
      </header>

      {/* Centered card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md bg-[#111111] border border-white/5 rounded-2xl p-8 shadow-2xl shadow-black/40">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-4 text-xs text-gray-500 text-center">
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
