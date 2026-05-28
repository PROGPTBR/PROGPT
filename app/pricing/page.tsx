import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { isPro } from '@/lib/billing/subscription';
import { PricingTable } from '@/components/billing/PricingTable';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const user = await getCurrentUser();
  const pro = user ? await isPro(user.id) : false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href={user ? '/chat' : '/'}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar
          </Link>
          {!user && (
            <Link
              href="/login?next=/pricing"
              className="text-xs text-brand hover:text-brand/80 transition-colors"
            >
              Entrar →
            </Link>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <PricingTable authed={!!user} isPro={pro} />
      </main>
    </div>
  );
}
