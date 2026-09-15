import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET/POST /api/plataforma/templates — CRUD de plataforma_templates
// (blueprints de config de org — NÃO confundir com a tabela `templates` de
// markdown por assistente). Super-admin only.

const CreateBody = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'slug deve ser lowercase, dígitos e hífen'),
  description: z.string().trim().max(1000).optional().default(''),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET() {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const { data, error } = await svc
    .from('plataforma_templates')
    .select('id, slug, name, description, config, is_active, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
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
  const { data: template, error } = await svc
    .from('plataforma_templates')
    .insert({
      name: body.name,
      slug: body.slug,
      description: body.description,
      config: body.config,
    })
    .select('id, slug, name, description, config, is_active, created_at, updated_at')
    .single();

  if (error || !template) {
    const isDuplicate = error?.code === '23505';
    return NextResponse.json(
      { error: isDuplicate ? 'slug_taken' : 'insert_failed' },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'plataforma_template.create',
    resourceType: 'plataforma_template',
    resourceId: template.id,
    metadata: { name: body.name, slug: body.slug },
  });

  return NextResponse.json({ template }, { status: 201 });
}
