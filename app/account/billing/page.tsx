import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Header } from '../../login/header';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { getSubscription } from '@/lib/billing/subscription';
import { SubscriptionPanel } from '@/components/billing/SubscriptionPanel';
import { BackButton } from '@/components/BackButton';

export const dynamic = 'force-dynamic';

export default async function AccountBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/billing');

  const subscription = await getSubscription(user.id);
  const profile = await getProfile(user.id);

  return (
    <>
    <Header />
    <div className="min-h-screen bg-background text-foreground">

      <main className="max-w-7xl mx-auto px-6 py-12">

          <div className="max-w-7xl mx-auto px-6 py-16 flex items-center justify-between">
           <BackButton />

            {!user && (
              <Link
                href="/login?next=/pricing"
                className="text-xs text-brand hover:text-brand/80 transition-colors"
              >
                Entrar →
              </Link>
            )}
          </div>

        <SubscriptionPanel
  subscription={subscription}
  profile={profile}
/>
      </main>
    </div>
    </>
  );
}
