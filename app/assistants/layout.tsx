import Link from 'next/link';
import { ArrowLeft, History } from 'lucide-react';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';

export const dynamic = 'force-dynamic';

export default async function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/assistants');
    throw err;
  }
  return (
    <div className="relative min-h-screen bg-background text-foreground font-outfit antialiased overflow-x-hidden">
      {/* Decorative cyan glow shapes — translucent cyan reads on both light
          and dark backgrounds. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
      />

      <header className="relative z-10 border-b border-border bg-card/40 backdrop-blur-md sticky top-0">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo size="md" priority />
          </Link>
          <div className="inline-flex items-center gap-4">
            <Link
              href="/assistants/history"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              Histórico
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Voltar ao chat
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
