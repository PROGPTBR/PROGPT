import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { isFiscalEnabled, fiscalHealthcheck } from '@/lib/fiscal/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/monitoramento — pulso em tempo real da plataforma.
// Adapta o painel "Monitoramento" do sistema de referência (que tem
// conceitos que o PROGPT não tem — linhas de WhatsApp, buffer, tickets de
// suporte próprios) pros dados reais que já existem aqui: login recente,
// sessões de chat ativas, custo/chamadas de IA, feedback não resolvido
// (proxy de "ticket aberto") e saúde do serviço fiscal (proxy de "serviço
// externo conectado").
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const sinceIso = new Date(Date.now() - DAY_MS).toISOString();

  const [
    { data: profiles },
    { data: orgs },
    { count: sessionsCount },
    { data: subs },
    { data: usageEvents },
    { count: unresolvedFeedback },
    fiscalEnabled,
  ] = await Promise.all([
    svc
      .from('profiles_with_email')
      .select('id, email, last_sign_in_at')
      .order('last_sign_in_at', { ascending: false, nullsFirst: false })
      .limit(10),
    svc.from('orgs').select('id, status'),
    svc.from('sessions').select('id', { count: 'exact', head: true }).gte('updated_at', sinceIso),
    svc.from('subscriptions').select('status'),
    svc
      .from('api_usage_events')
      .select('call_count, cost_usd_cents')
      .gte('created_at', sinceIso),
    svc
      .from('message_feedback')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null)
      .eq('rating', 'down'),
    Promise.resolve(isFiscalEnabled()),
  ]);

  let fiscalHealthy: boolean | null = null;
  if (fiscalEnabled) {
    fiscalHealthy = await fiscalHealthcheck().catch(() => false);
  }

  const now = Date.now();
  const recentLogins = (profiles ?? []).filter(
    (p) => p.last_sign_in_at && now - new Date(p.last_sign_in_at).getTime() <= DAY_MS,
  );

  const orgsActive = (orgs ?? []).filter((o) => o.status === 'active').length;
  const payingUsers = (subs ?? []).filter((s) =>
    ['active', 'trialing', 'past_due'].includes(s.status ?? ''),
  ).length;

  let aiCalls24h = 0;
  let costCents24h = 0;
  for (const e of (usageEvents ?? []) as Array<{ call_count: number; cost_usd_cents: number }>) {
    aiCalls24h += Number(e.call_count) || 0;
    costCents24h += Number(e.cost_usd_cents) || 0;
  }

  return NextResponse.json({
    kpis: {
      usersLoggedIn24h: recentLogins.length,
      orgsActive,
      totalOrgs: (orgs ?? []).length,
      sessionsActive24h: sessionsCount ?? 0,
      payingUsers,
      aiCalls24h,
      aiCostCents24h: costCents24h,
      unresolvedNegativeFeedback: unresolvedFeedback ?? 0,
    },
    fiscalService: { enabled: fiscalEnabled, healthy: fiscalHealthy },
    recentLogins: (profiles ?? []).slice(0, 10).map((p) => ({
      id: p.id,
      email: p.email,
      lastSignInAt: p.last_sign_in_at,
    })),
  });
}
