import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getSubscription } from '@/lib/billing/subscription';
import { SubscriptionPanel } from '@/components/billing/SubscriptionPanel';

export const dynamic = 'force-dynamic';

export default async function AccountBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/billing');

  const subscription = await getSubscription(user.id);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Voltar
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-12">
        <SubscriptionPanel subscription={subscription} />
      </main>
    </div>
  );
}
