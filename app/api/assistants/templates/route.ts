import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listTemplates } from '@/lib/assistants/templates';
import { ASSISTANT_TYPES, type AssistantType } from '@/lib/assistants/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/templates?type=rfp — authed users list templates
// to populate the form's template picker. Returns a slim shape (no body_md)
// to keep the payload small; the body is fetched server-side at generation
// time.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const typeParam = url.searchParams.get('type');
  if (!typeParam || !(ASSISTANT_TYPES as readonly string[]).includes(typeParam)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }
  const rows = await listTemplates(typeParam as AssistantType);

  return NextResponse.json({
    templates: rows.map((r) => ({
      id: r.id,
      assistant_type: r.assistant_type,
      name: r.name,
      description: r.description,
      // Intentionally omitting body_md — clients don't need it.
    })),
  });
}
