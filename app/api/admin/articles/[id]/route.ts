import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import {
  isCanonicalTheme,
  normalizeCandidateTheme,
  MAX_THEME_LENGTH,
} from '@/lib/ingest/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBody = z
  .object({
    title: z.string().min(3).max(200).optional(),
    // Any non-empty string ≤ MAX_THEME_LENGTH. Status is derived server-side
    // so the client cannot promote a candidate by passing theme_status itself.
    theme: z
      .string()
      .transform(normalizeCandidateTheme)
      .refine((s) => s.length >= 1 && s.length <= MAX_THEME_LENGTH, {
        message: `theme must be 1–${MAX_THEME_LENGTH} chars after trim`,
      })
      .optional(),
  })
  .refine((b) => b.title !== undefined || b.theme !== undefined, {
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
  const { error } = await sb.from('articles').delete().eq('id', params.id);
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
    const json = await req.json();
    body = PatchBody.parse(json);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const update: { title?: string; theme?: string; theme_status?: 'canonical' | 'candidate' } = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.theme !== undefined) {
    update.theme = body.theme;
    // Derive status server-side so editing to a canonical name automatically
    // re-canonicalizes the row (and vice versa).
    update.theme_status = isCanonicalTheme(body.theme) ? 'canonical' : 'candidate';
  }

  const sb = getServerSupabase();
  const { error } = await sb.from('articles').update(update).eq('id', params.id);
  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, themeStatus: update.theme_status });
}
