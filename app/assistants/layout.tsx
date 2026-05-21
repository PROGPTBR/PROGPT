import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    <div className="relative min-h-screen bg-[#0d0d0d] text-white font-outfit antialiased overflow-x-hidden">
      {/* Decorative cyan glow shapes */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 -left-20 h-80 w-80 rounded-full bg-brand/5 blur-3xl"
      />

      <header className="relative z-10 border-b border-white/5 backdrop-blur-md bg-black/20 sticky top-0">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo size="md" priority />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar ao chat
          </Link>
        </div>
      </header>

      <main className="brand-dark relative z-10 mx-auto max-w-6xl px-6 py-10">
        {children}
      </main>
    </div>
  );
}
