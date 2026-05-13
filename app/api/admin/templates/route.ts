import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin, getCurrentUser } from '@/lib/auth';
import {
  TemplateCreateSchema,
  ASSISTANT_TYPES,
  type AssistantType,
} from '@/lib/assistants/types';
import { createTemplate, listTemplates } from '@/lib/assistants/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type');
  const type =
    typeParam && (ASSISTANT_TYPES as readonly string[]).includes(typeParam)
      ? (typeParam as AssistantType)
      : undefined;

  const rows = await listTemplates(type);
  return NextResponse.json({ templates: rows });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = TemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.message },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  const row = await createTemplate({
    assistant_type: parsed.data.assistant_type,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    body_md: parsed.data.body_md,
    created_by: user?.id,
  });
  if (!row) return NextResponse.json({ error: 'insert_failed' }, { status: 500 });
  return NextResponse.json({ template: row }, { status: 201 });
}
