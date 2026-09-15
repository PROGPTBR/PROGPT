import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/users/[id] — painel de um usuário só (sub-projeto
// "gestão por usuário", 2026-09-15): perfil + org + assinatura + uso.
// Self-contido em /plataforma (não depende de role==='admin' — só de
// super_admin) porque o desenho de `super_admin` é ORTOGONAL a `role` (ver
// "O que evitar" no CLAUDE.md); um super_admin que não seja admin ainda
// precisa conseguir gerir qualquer usuário por aqui.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const [
    { data: profile, error: profileError },
    { data: sub },
    { count: sessionsCount },
    { count: runsCount },
    { data: events },
  ] = await Promise.all([
      svc
        .from('profiles_with_email')
        .select('id, email, role, display_name, org_id, super_admin, banned_until, created_at, last_sign_in_at')
        .eq('id', params.id)
        .maybeSingle(),
      svc
        .from('subscriptions')
        .select('status, plan, payment_method, trial_end, current_period_start, current_period_end, cancel_at_period_end')
        .eq('user_id', params.id)
        .maybeSingle(),
      svc.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', params.id),
      svc.from('assistant_runs').select('id', { count: 'exact', head: true }).eq('user_id', params.id),
      svc
        .from('api_usage_events')
        .select('cost_usd_cents, tokens_in, tokens_out')
        .eq('user_id', params.id),
    ]);

  if (profileError) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  if (!profile) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });

  const { data: org } = await svc.from('orgs').select('id, name, slug').eq('id', profile.org_id).maybeSingle();

  let spendCents = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  for (const e of (events ?? []) as Array<{ cost_usd_cents: number; tokens_in: number; tokens_out: number }>) {
    spendCents += Number(e.cost_usd_cents) || 0;
    tokensIn += Number(e.tokens_in) || 0;
    tokensOut += Number(e.tokens_out) || 0;
  }

  const bannedUntil = profile.banned_until as string | null;

  return NextResponse.json({
    profile: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      displayName: profile.display_name,
      superAdmin: profile.super_admin,
      active: !bannedUntil || new Date(bannedUntil).getTime() <= Date.now(),
      createdAt: profile.created_at,
      lastSignInAt: profile.last_sign_in_at,
    },
    org,
    subscription: sub ?? null,
    usage: {
      sessions: sessionsCount ?? 0,
      runs: runsCount ?? 0,
      spendCents,
      tokensIn,
      tokensOut,
    },
  });
}

// PATCH /api/plataforma/users/[id] — mover usuário de org, conceder/revogar
// super_admin, e (aditivo) trocar o papel (role). org_id/super_admin são
// guardados por trigger no banco (guard_plataforma_columns, migration
// 0053) — só passa porque este endpoint usa getServerSupabase()
// (service-role).
const PatchBody = z
  .object({
    orgId: z.string().uuid().optional(),
    superAdmin: z.boolean().optional(),
    role: z.enum(['user', 'admin', 'gestor']).optional(),
  })
  .refine((b) => b.orgId !== undefined || b.superAdmin !== undefined || b.role !== undefined, {
    message: 'at least one field required',
  });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid_body' },
      { status: 400 },
    );
  }

  if (params.id === admin.user.id && body.superAdmin === false) {
    return NextResponse.json({ error: 'cannot_revoke_self' }, { status: 400 });
  }
  if (params.id === admin.user.id && body.role !== undefined) {
    return NextResponse.json({ error: 'cannot_edit_own_role' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (body.orgId !== undefined) update.org_id = body.orgId;
  if (body.superAdmin !== undefined) update.super_admin = body.superAdmin;
  if (body.role !== undefined) update.role = body.role;

  const { error } = await svc.from('profiles').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  if (body.orgId !== undefined) {
    void recordAuditLog({
      actorId: admin.user.id,
      actorEmail: admin.user.email,
      action: 'user.assign_org',
      resourceType: 'profile',
      resourceId: params.id,
      orgId: body.orgId,
      metadata: { orgId: body.orgId },
    });
  }
  if (body.superAdmin !== undefined) {
    void recordAuditLog({
      actorId: admin.user.id,
      actorEmail: admin.user.email,
      action: body.superAdmin ? 'user.grant_super_admin' : 'user.revoke_super_admin',
      resourceType: 'profile',
      resourceId: params.id,
    });
  }
  if (body.role !== undefined) {
    void recordAuditLog({
      actorId: admin.user.id,
      actorEmail: admin.user.email,
      action: 'user.role_change',
      resourceType: 'profile',
      resourceId: params.id,
      metadata: { toRole: body.role },
    });
  }

  return NextResponse.json({ ok: true });
}
