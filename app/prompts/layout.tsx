import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { Header } from '../login/header';

export const dynamic = 'force-dynamic';

export default async function PromptsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/prompts');
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
        <main className="relative z-10 mx-auto max-w-7xl px-6 pt-24 pb-10">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Voltar ao chat
          </Link>
          {children}
        </main>
      </div>
    </>
  );
}
