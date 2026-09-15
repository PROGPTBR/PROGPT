import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/plataforma/users/[id] — mover usuário de org e/ou
// conceder/revogar super_admin. Ambas colunas são guardadas por trigger no
// banco (guard_plataforma_columns, migration 0053) — só passa porque este
// endpoint usa getServerSupabase() (service-role).
const PatchBody = z
  .object({
    orgId: z.string().uuid().optional(),
    superAdmin: z.boolean().optional(),
  })
  .refine((b) => b.orgId !== undefined || b.superAdmin !== undefined, {
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

  const svc = getServerSupabase();
  const update: Record<string, unknown> = {};
  if (body.orgId !== undefined) update.org_id = body.orgId;
  if (body.superAdmin !== undefined) update.super_admin = body.superAdmin;

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

  return NextResponse.json({ ok: true });
}
