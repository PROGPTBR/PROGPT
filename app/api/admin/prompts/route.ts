import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tags = z.array(z.string().min(1).max(60)).max(30);

const CreateBody = z.object({
  title: z.string().min(3).max(200),
  summary: z.string().max(500).optional().default(''),
  content: z.string().min(1),
  category: z.string().min(1).max(60).optional().default('Geral'),
  tags: tags.optional().default([]),
  is_published: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('prompts')
    .select(
      'id, prompt_number, title, summary, content, category, tags, is_published, source, created_at, updated_at',
    )
    .order('category', { ascending: true })
    .order('prompt_number', { ascending: true, nullsFirst: false });
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  return NextResponse.json({ prompts: data ?? [] });
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof CreateBody>;
  try {
    body = CreateBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('prompts')
    .insert({
      title: body.title,
      summary: body.summary,
      content: body.content,
      category: body.category,
      tags: body.tags,
      is_published: body.is_published,
      source: 'admin',
    })
    .select('id')
    .single();
  if (error || !data) {
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
