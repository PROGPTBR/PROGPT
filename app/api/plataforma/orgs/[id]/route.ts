import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/plataforma/orgs/[id] — toggle status (active/inactive) e/ou
// atribuir/trocar template (dispara plataforma_provisionar_org).

const PatchBody = z
  .object({
    status: z.enum(['active', 'inactive']).optional(),
    templateId: z.string().uuid().optional(),
  })
  .refine((b) => b.status !== undefined || b.templateId !== undefined, {
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

  const svc = getServerSupabase();

  if (body.templateId) {
    const { error: provisionError } = await svc.rpc('plataforma_provisionar_org', {
      p_org_id: params.id,
      p_template_id: body.templateId,
    });
    if (provisionError) {
      return NextResponse.json({ error: 'provision_failed' }, { status: 500 });
    }
    void recordAuditLog({
      actorId: admin.user.id,
      actorEmail: admin.user.email,
      action: 'org.set_template',
      resourceType: 'org',
      resourceId: params.id,
      orgId: params.id,
      metadata: { templateId: body.templateId },
    });
  }

  if (body.status) {
    const { error } = await svc
      .from('orgs')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    void recordAuditLog({
      actorId: admin.user.id,
      actorEmail: admin.user.email,
      action: 'org.toggle',
      resourceType: 'org',
      resourceId: params.id,
      orgId: params.id,
      metadata: { status: body.status },
    });
  }

  return NextResponse.json({ ok: true });
}
