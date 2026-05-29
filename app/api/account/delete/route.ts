import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { supabaseServer } from '@/lib/db/supabase-server';
import { getServerSupabase } from '@/lib/db/supabase';
import { getSubscription } from '@/lib/billing/subscription';
import { cancelAsaasSubscription, AsaasError } from '@/lib/billing/asaas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Sub-projeto 25 — Account deletion (LGPD).
//
// User clica em "Excluir minha conta" → /account/delete page → digita
// EXCLUIR → POST aqui.
//
// 1. requireUser → 401 se não logado
// 2. body { confirmation: 'EXCLUIR' } (defesa em profundidade — UI também
//    valida, mas o server não pode confiar no client)
// 2b. cancelar subscription no Asaas ANTES de deletar — senão o cartão
//     continua sendo cobrado numa conta que não existe mais (chargeback +
//     violação LGPD). Se o cancel falhar com erro real (não-404), aborta
//     o delete: melhor adiar a exclusão do que deixar o cartão cobrando.
// 3. auth.admin.deleteUser(user.id) — cascateia via FK:
//    - profiles (CASCADE)
//    - sessions (CASCADE)
//    - assistant_runs (CASCADE)
//    - message_feedback (CASCADE)
//    - ingestion_jobs (CASCADE)
//    - rate_limit_events (CASCADE)
//    - api_usage_events.user_id (SET NULL — preserva histórico de custo
//      anonimizado, decisão sub-projeto 23)
// 4. signOut() via cookie-aware client (limpa cookies da sessão)
// 5. 204

const Body = z.object({
  confirmation: z.string(),
});

const CONFIRMATION_PHRASE = 'EXCLUIR';

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (parsed.confirmation !== CONFIRMATION_PHRASE) {
    return NextResponse.json({ error: 'confirmation_mismatch' }, { status: 400 });
  }

  // Cancela cobrança recorrente no Asaas antes da exclusão destrutiva.
  const sub = await getSubscription(user.id);
  if (
    sub?.asaas_subscription_id &&
    sub.status !== 'cancelled' &&
    sub.status !== 'expired'
  ) {
    try {
      await cancelAsaasSubscription(sub.asaas_subscription_id);
    } catch (err) {
      console.error('[account-delete] Asaas cancel failed:', err);
      if (!(err instanceof AsaasError && err.status === 404)) {
        // Erro real do provedor — não deleta, senão a conta some mas o
        // cartão continua sendo cobrado. User pode tentar de novo.
        return NextResponse.json({ error: 'billing_provider_error' }, { status: 502 });
      }
      // 404 → Asaas já não tem a subscription; segue com o delete.
    }
  }

  const svc = getServerSupabase();
  const { error: delErr } = await svc.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error('[account-delete] admin.deleteUser failed:', delErr.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  // Limpa cookies de sessão. Cookie-aware client, não service-role.
  await supabaseServer().auth.signOut();

  return new NextResponse(null, { status: 204 });
}
