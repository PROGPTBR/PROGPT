import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/console — home do console Super Admin. Agrega o que
// hoje está espalhado por /admin/monitor + audit_log numa visão de topo:
// KPIs, alertas ("precisa de atenção") e atividade recente. Cada cliente
// pagante do PROGPT é 1 USUÁRIO (não uma org com equipe, diferente do
// padrão de referência copiado em sub-projeto 57b) — os alertas refletem
// isso: assinatura vencida, sem cartão vinculado, etc.
const PAYING_STATUSES = new Set(['active', 'trialing', 'past_due']);

export async function GET() {
  let staff;
  try {
    staff = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  void staff;

  const svc = getServerSupabase();

  const [
    { data: profiles, error: profilesError },
    { data: orgs, error: orgsError },
    { data: templates, error: templatesError },
    { data: subs, error: subsError },
    { data: auditRows, error: auditError },
  ] = await Promise.all([
    svc.from('profiles_with_email').select('id, email, role, created_at'),
    svc.from('orgs').select('id, name, status'),
    svc.from('plataforma_templates').select('id'),
    svc
      .from('subscriptions')
      .select('user_id, status, plan, current_period_end, trial_end'),
    svc
      .from('audit_log')
      .select('id, actor_email, action, resource_type, resource_id, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  if (profilesError || orgsError || templatesError || subsError || auditError) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const emailByUser = new Map((profiles ?? []).map((p) => [p.id, p.email as string]));
  const now = Date.now();

  const payingSubs = (subs ?? []).filter((s) => PAYING_STATUSES.has(s.status ?? ''));
  const pastDue = (subs ?? []).filter((s) => s.status === 'past_due');
  const trialEndingSoon = (subs ?? []).filter((s) => {
    if (s.status !== 'trialing' || !s.trial_end) return false;
    const daysLeft = (new Date(s.trial_end).getTime() - now) / 86_400_000;
    return daysLeft >= 0 && daysLeft <= 1;
  });

  return NextResponse.json({
    kpis: {
      totalOrgs: (orgs ?? []).length,
      totalUsers: (profiles ?? []).length,
      payingUsers: payingSubs.length,
      totalTemplates: (templates ?? []).length,
    },
    alerts: {
      pastDue: pastDue.map((s) => ({ userId: s.user_id, email: emailByUser.get(s.user_id) ?? '—' })),
      trialEndingSoon: trialEndingSoon.map((s) => ({
        userId: s.user_id,
        email: emailByUser.get(s.user_id) ?? '—',
        trialEnd: s.trial_end,
      })),
    },
    recentActivity: (auditRows ?? []).map((a) => ({
      id: a.id,
      actorEmail: a.actor_email,
      action: a.action,
      resourceType: a.resource_type,
      resourceId: a.resource_id,
      createdAt: a.created_at,
    })),
  });
}
