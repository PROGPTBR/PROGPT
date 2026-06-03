import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { BrandLogo } from '@/components/brand/BrandLogo';

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
    <div className="relative min-h-screen bg-background dark:bg-[#0d0d0d] text-foreground dark:text-white font-outfit antialiased overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-1/4 h-96 w-96 rounded-full bg-brand/8 blur-3xl"
      />
      <header className="relative z-10 border-b border-border bg-card/40 dark:bg-black/20 backdrop-blur-md sticky top-0">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center">
            <BrandLogo size="md" priority />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar ao chat
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-6 py-10">{children}</main>
    </div>
  );
}
