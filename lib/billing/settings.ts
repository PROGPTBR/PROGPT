import { getServerSupabase } from '@/lib/db/supabase';

// Config de billing administrável (sub-projeto 36). O admin edita pelo painel
// /admin/billing e os valores ficam na tabela singleton `billing_settings`.
// Fallback pro env quando a linha/campo está vazio — assim o sistema funciona
// antes de o admin configurar e a chave de produção pode viver só no Railway.

export type BillingSettings = {
  apiKey: string;
  apiUrl: string;
  planPrice: number;
  trialDays: number;
};

export async function getBillingSettings(): Promise<BillingSettings> {
  const envUrl = process.env.ASAAS_API_URL ?? 'https://sandbox.asaas.com/api/v3';
  const fallback: BillingSettings = {
    apiKey: process.env.ASAAS_API_KEY ?? '',
    apiUrl: envUrl,
    planPrice: 197.99,
    trialDays: 3,
  };

  try {
    const sb = getServerSupabase();
    const { data } = await sb
      .from('billing_settings')
      .select('asaas_api_key, asaas_api_url, plan_price, trial_days')
      .eq('id', 1)
      .maybeSingle();

    const row = data as {
      asaas_api_key?: string | null;
      asaas_api_url?: string | null;
      plan_price?: number | string | null;
      trial_days?: number | null;
    } | null;

    if (!row) return fallback;

    return {
      apiKey: row.asaas_api_key?.trim() || fallback.apiKey,
      apiUrl: row.asaas_api_url?.trim() || fallback.apiUrl,
      planPrice: row.plan_price != null ? Number(row.plan_price) : fallback.planPrice,
      trialDays: row.trial_days != null ? Number(row.trial_days) : fallback.trialDays,
    };
  } catch {
    return fallback;
  }
}
