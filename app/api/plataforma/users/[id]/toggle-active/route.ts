import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Espelha /api/admin/users/[id]/toggle-active (sub-projeto 55), mas
// gateado por requireSuperAdmin em vez de requireAdmin — self-contido em
// /plataforma pra não depender de o super_admin também ser role==='admin'.
const Body = z.object({ active: z.boolean() });
const PERMANENT_BAN = '876000h';

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

  if (params.id === admin.user.id && !body.active) {
    return NextResponse.json({ error: 'cannot_deactivate_self' }, { status: 400 });
  }

  const svc = getServerSupabase();
  const { error } = await svc.auth.admin.updateUserById(params.id, {
    ban_duration: body.active ? 'none' : PERMANENT_BAN,
  });
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: body.active ? 'user.activate' : 'user.deactivate',
    resourceType: 'profile',
    resourceId: params.id,
  });
  return NextResponse.json({ ok: true, active: body.active });
}
