import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { Header } from '../login/header';

export const dynamic = 'force-dynamic';

// Mesma moldura das outras telas do produto (/assistants, /painel): topo com
// navegação + container centrado. Sem isto o /fluxo abria colado na borda, sem
// jeito de voltar.
export default async function FluxoLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/fluxo');
    throw err;
  }

  return (
    <>
      <Header />
      <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
        />

        <main className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
          <div className="mb-6">
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Voltar ao chat
            </Link>
          </div>
          {children}
        </main>
      </div>
    </>
  );
}
