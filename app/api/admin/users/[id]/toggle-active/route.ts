import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/users/[id]/toggle-active — ativar/desativar login da conta
// (visão "Super Admin"). Diferente de /api/admin/billing/users/[id]/access
// (que libera/bloqueia acesso PAGO via subscriptions.status) — isto bloqueia
// o LOGIN inteiro via Supabase Auth (ban_duration), independente de plano.
// Não existe coluna própria de "ativo": o estado vem de auth.users.banned_until,
// exposto via profiles_with_email (migration 0051).
const Body = z.object({ active: z.boolean() });

// ~100 anos — Supabase Admin API não aceita duração "infinita" literal;
// esse valor é o padrão de fato usado como "ban permanente" (revertido a
// qualquer momento com ban_duration:'none').
const PERMANENT_BAN = '876000h';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (params.id === admin.user.id && !body.active) {
    return NextResponse.json({ error: 'cannot_deactivate_self' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const { error } = await svc.auth.admin.updateUserById(params.id, {
    ban_duration: body.active ? 'none' : PERMANENT_BAN,
  });
  if (error) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: body.active ? 'user.activate' : 'user.deactivate',
    resourceType: 'profile',
    resourceId: params.id,
  });
  return NextResponse.json({ ok: true, active: body.active });
}
