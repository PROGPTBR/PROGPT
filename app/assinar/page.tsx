import { redirect } from 'next/navigation';
import { getCurrentUser, getProfile } from '@/lib/auth';
import { hasAccess } from '@/lib/billing/subscription';
import { getBillingSettings } from '@/lib/billing/settings';
import { Header } from '../login/header';
import { StartTrial } from '@/components/billing/StartTrial';

export const dynamic = 'force-dynamic';

// Sub-projeto 36.1 — gate de cadastro do cartão. Todo novo usuário sem acesso
// (não-admin, sem trial/assinatura, conta criada após o cutoff) cai aqui antes
// de poder usar o chat/assistentes.
export default async function AssinarPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/assinar');

  // Já tem acesso (admin, conta antiga ou assinatura/trial válidos) → chat.
  if (await hasAccess(user.id, user.created_at)) redirect('/chat');

  const [settings, profile] = await Promise.all([
    getBillingSettings(),
    getProfile(user.id),
  ]);
  const priceLabel = `R$ ${settings.planPrice.toFixed(2).replace('.', ',')}`;

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
        <main className="relative z-10 mx-auto max-w-5xl px-6 pt-28 pb-16">
          <StartTrial
            priceLabel={priceLabel}
            trialDays={settings.trialDays}
            initial={profile}
          />
        </main>
      </div>
    </>
  );
}
