import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tags = z.array(z.string().min(1).max(60)).max(30);

const PatchBody = z
  .object({
    title: z.string().min(3).max(200).optional(),
    summary: z.string().max(500).optional(),
    content: z.string().min(1).optional(),
    category: z.string().min(1).max(60).optional(),
    tags: tags.optional(),
    is_published: z.boolean().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, {
    message: 'at least one field required',
  });

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  const sb = getServerSupabase();
  const { error } = await sb.from('prompts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) update.title = body.title;
  if (body.summary !== undefined) update.summary = body.summary;
  if (body.content !== undefined) update.content = body.content;
  if (body.category !== undefined) update.category = body.category;
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.is_published !== undefined) update.is_published = body.is_published;

  const sb = getServerSupabase();
  const { error } = await sb.from('prompts').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
