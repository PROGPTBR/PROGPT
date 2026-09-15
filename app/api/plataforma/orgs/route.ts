import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET/POST /api/plataforma/orgs — cross-tenant org management, super-admin
// only. 404 (not 403) for non-super-admins — mesmo padrão de /api/admin/*
// (não revelar a existência do endpoint).

const CreateBody = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug deve ser lowercase, dígitos e hífen'),
  templateId: z.string().uuid().optional(),
});

export async function GET() {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  void admin;

  const svc = getServerSupabase();
  const { data: orgs, error } = await svc
    .from('orgs')
    .select('id, name, slug, status, template_id, org_settings, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });

  const { data: counts } = await svc.from('profiles').select('org_id');
  const userCountByOrg = new Map<string, number>();
  for (const row of counts ?? []) {
    userCountByOrg.set(row.org_id, (userCountByOrg.get(row.org_id) ?? 0) + 1);
  }

  return NextResponse.json({
    orgs: (orgs ?? []).map((o) => ({ ...o, userCount: userCountByOrg.get(o.id) ?? 0 })),
  });
}

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid_body' },
      { status: 400 },
    );
  }

  const svc = getServerSupabase();
  const { data: org, error } = await svc
    .from('orgs')
    .insert({ name: body.name, slug: body.slug })
    .select('id, name, slug, status, template_id, org_settings, created_at')
    .single();

  if (error || !org) {
    const isDuplicate = error?.code === '23505';
    return NextResponse.json(
      { error: isDuplicate ? 'slug_taken' : 'insert_failed' },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  if (body.templateId) {
    const { error: provisionError } = await svc.rpc('plataforma_provisionar_org', {
      p_org_id: org.id,
      p_template_id: body.templateId,
    });
    if (provisionError) {
      return NextResponse.json(
        { error: 'provision_failed', org },
        { status: 207 },
      );
    }
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'org.create',
    resourceType: 'org',
    resourceId: org.id,
    orgId: org.id,
    metadata: { name: body.name, slug: body.slug, templateId: body.templateId ?? null },
  });

  return NextResponse.json({ org }, { status: 201 });
}
