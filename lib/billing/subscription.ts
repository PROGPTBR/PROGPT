import { getServerSupabase } from '@/lib/db/supabase';

// Sub-projeto 27 — helpers de subscription pra leitura.
//
// `getActiveSubscription` consulta o DB; `isPro` é o teste rápido usado
// pelas checks de paywall em /api/assistants/*. Mutações vão direto pelo
// webhook de Asaas — não exponho helpers de update aqui.

export type Subscription = {
  id: string;
  user_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  status: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired';
  plan: string;
  payment_method: 'credit_card' | 'pix' | 'boleto' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Retorna a subscription do user se existir (qualquer status). Single
 * row pelo unique constraint em user_id.
 */
export async function getSubscription(userId: string): Promise<Subscription | null> {
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[billing] getSubscription failed:', error.message);
    return null;
  }
  return (data as Subscription) ?? null;
}

/**
 * Retorna subscription só se Pro **ativo** (status active OU past_due
 * com period ainda válido). past_due conta como ativo até o fim do
 * ciclo já pago — comportamento padrão de billing recorrente.
 */
export async function getActiveSubscription(
  userId: string,
): Promise<Subscription | null> {
  const sub = await getSubscription(userId);
  if (!sub) return null;
  if (sub.status === 'active') return sub;
  if (sub.status === 'past_due') {
    // past_due: já pagou ciclo atual mas próxima cobrança falhou.
    // Mantém acesso até current_period_end.
    if (sub.current_period_end && new Date(sub.current_period_end) > new Date()) {
      return sub;
    }
  }
  return null;
}

/**
 * Test rápido de Pro. Usado em /api/assistants/* paywall checks.
 *
 * Admins bypassam billing (sub-projeto 27.1) — não precisam de
 * subscription pra usar tudo. Útil pra QA/team interno + protege contra
 * o cenário "admin sem cartão fica trancado fora do produto que ele tá
 * dev/operando".
 *
 * Não cacheia ainda (v1.1 pode adicionar request-scoped cache via
 * AsyncLocalStorage), mas as queries são index-only.
 */
export async function isPro(userId: string): Promise<boolean> {
  const sb = getServerSupabase();
  const { data: profile } = await sb
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if ((profile as { role?: string } | null)?.role === 'admin') return true;

  const sub = await getActiveSubscription(userId);
  return sub !== null;
}
