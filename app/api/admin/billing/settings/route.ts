import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 36 — admin atualiza a config do Asaas (billing_settings).
// requireAdmin → 404 pra non-admin (não revela a rota). A chave do Asaas
// só é gravada se vier não-vazia (o painel nunca recebe a chave em claro).
const Body = z.object({
  asaasApiUrl: z.string().url().optional(),
  asaasApiKey: z.string().optional(),
  planPrice: z.number().positive().max(99999).optional(),
  trialDays: z.number().int().min(0).max(60).optional(),
});

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof NotAuthenticated)
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    if (e instanceof NotAdmin)
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    throw e;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.asaasApiUrl) update.asaas_api_url = body.asaasApiUrl;
  if (body.asaasApiKey && body.asaasApiKey.trim())
    update.asaas_api_key = body.asaasApiKey.trim();
  if (body.planPrice != null) update.plan_price = body.planPrice;
  if (body.trialDays != null) update.trial_days = body.trialDays;

  const svc = getServerSupabase();
  const { error } = await svc.from('billing_settings').update(update).eq('id', 1);
  if (error) {
    console.error('[admin/billing/settings] update failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
