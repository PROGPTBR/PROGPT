import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Espelha /api/admin/users/[id]/reset-password (sub-projeto 55) — mesmo
// resetPasswordForEmail nativo do Supabase, nunca senha em texto puro.
// Gateado por requireSuperAdmin (self-contido em /plataforma).
function originFrom(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const { data, error: lookupError } = await svc
    .from('profiles_with_email')
    .select('email')
    .eq('id', params.id)
    .maybeSingle();

  if (lookupError || !data?.email) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const { error } = await svc.auth.resetPasswordForEmail(data.email, {
    redirectTo: `${originFrom(req)}/reset-password`,
  });
  if (error) {
    return NextResponse.json({ error: 'send_failed', detail: error.message }, { status: 502 });
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'user.reset_password_request',
    resourceType: 'profile',
    resourceId: params.id,
  });
  return NextResponse.json({ ok: true });
}
