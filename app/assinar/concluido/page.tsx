import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { getSubscription } from '@/lib/billing/subscription';

export const dynamic = 'force-dynamic';

// Sub-projeto 36.1 — landing do successUrl do hosted checkout do Asaas.
// O usuário só chega aqui após concluir o cadastro do cartão no Asaas. Marcamos
// a assinatura 'pending' → 'trialing' de forma otimista (o cartão foi
// cadastrado), liberando o acesso na hora — mesmo antes de o webhook do Asaas
// chegar. O webhook depois confirma e cuida da 1ª cobrança pós-trial.
export default async function TrialConfirmedPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/chat');

  const sub = await getSubscription(user.id);
  if (
    sub &&
    sub.status === 'pending' &&
    sub.asaas_subscription_id &&
    sub.trial_end &&
    new Date(sub.trial_end).getTime() > Date.now()
  ) {
    const svc = getServerSupabase();
    await svc
      .from('subscriptions')
      .update({ status: 'trialing', updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('status', 'pending');
  }

  redirect('/chat');
}
