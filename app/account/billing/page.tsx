import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { getCurrentUser} from '@/lib/auth';
import { getSubscription } from '@/lib/billing/subscription';
import { SubscriptionPanel } from '@/components/billing/SubscriptionPanel';
import { SeatMembersPanel } from '@/components/billing/SeatMembersPanel';

export const dynamic = 'force-dynamic';

export default async function AccountBillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/billing');

  const subscription = await getSubscription(user.id);

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <SubscriptionPanel subscription={subscription} />

      {/* Licenças da assinatura — só aparece pra quem contratou mais de
          um usuário (sub-projeto 64). */}
      <div className="mt-8">
        <SeatMembersPanel />
      </div>
    </AppShell>
  );
}
