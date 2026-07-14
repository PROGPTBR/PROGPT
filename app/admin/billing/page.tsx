import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/db/supabase';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { BillingAdmin } from '@/components/admin/BillingAdmin';

export const dynamic = 'force-dynamic';

// Sub-projeto 36 — painel de billing. Faturamento é admin-only mesmo dentro do
// admin (o layout agora deixa GESTOR entrar na área, mas billing não).
export default async function AdminBillingPage() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) notFound();
    throw err;
  }
  const svc = getServerSupabase();

  const { data: settingsRow } = await svc
    .from('billing_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  const s = settingsRow as {
    asaas_api_key?: string | null;
    asaas_api_url?: string | null;
    plan_price?: number | string | null;
    trial_days?: number | null;
  } | null;

  const { data: profiles } = await svc
    .from('profiles_with_email')
    .select('id, email, role');

  const { data: subs } = await svc
    .from('subscriptions')
    .select('user_id, status, plan, trial_end, current_period_end, updated_at');

  const subMap = new Map(
    (subs ?? []).map((row) => [(row as { user_id: string }).user_id, row]),
  );

  const users = ((profiles ?? []) as Array<{
    id: string;
    email: string | null;
    role: string | null;
  }>)
    .map((p) => {
      const sub = subMap.get(p.id) as
        | {
            status: string;
            trial_end: string | null;
            current_period_end: string | null;
            updated_at: string;
          }
        | undefined;
      return {
        id: p.id,
        email: p.email ?? '—',
        role: p.role ?? 'user',
        status: sub?.status ?? 'none',
        trialEnd: sub?.trial_end ?? null,
        periodEnd: sub?.current_period_end ?? null,
        updatedAt: sub?.updated_at ?? null,
      };
    })
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));

  const key = s?.asaas_api_key ?? '';
  const maskedKey =
    key.length > 12 ? `${key.slice(0, 8)}••••••${key.slice(-4)}` : key ? '••••••' : '';

  return (
    <BillingAdmin
      settings={{
        asaasApiUrl: s?.asaas_api_url ?? 'https://sandbox.asaas.com/api/v3',
        planPrice: s?.plan_price != null ? Number(s.plan_price) : 197.99,
        trialDays: s?.trial_days ?? 3,
        hasKey: !!key,
        maskedKey,
      }}
      users={users}
    />
  );
}
