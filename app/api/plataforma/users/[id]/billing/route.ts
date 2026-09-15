import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Espelha /api/admin/billing/users/[id]/access (sub-projeto 36) — libera ou
// bloqueia o acesso PAGO do usuário manualmente (subscriptions.status),
// distinto de ativar/desativar LOGIN (toggle-active). Self-contido em
// /plataforma pra a gestão por-usuário ficar completa num painel só.
const Body = z.object({ action: z.enum(['release', 'block']) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const now = new Date().toISOString();
  const status = body.action === 'release' ? 'active' : 'expired';

  const { error } = await svc
    .from('subscriptions')
    .upsert({ user_id: params.id, status, plan: 'pro', updated_at: now }, { onConflict: 'user_id' });

  if (error) {
    console.error('[plataforma/billing] upsert failed:', error.message);
    return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: body.action === 'release' ? 'user.billing_release' : 'user.billing_block',
    resourceType: 'profile',
    resourceId: params.id,
  });
  return NextResponse.json({ ok: true, status });
}
