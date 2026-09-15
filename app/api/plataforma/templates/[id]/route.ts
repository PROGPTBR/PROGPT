import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBody = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    is_active: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'at least one field required' });

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

  const svc = getServerSupabase();
  const { error } = await svc
    .from('plataforma_templates')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'plataforma_template.update',
    resourceType: 'plataforma_template',
    resourceId: params.id,
    metadata: { fields: Object.keys(body) },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const { error } = await svc.from('plataforma_templates').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'plataforma_template.delete',
    resourceType: 'plataforma_template',
    resourceId: params.id,
  });

  return new NextResponse(null, { status: 204 });
}
