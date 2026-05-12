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

// POST /api/admin/themes/rename — bulk rename (and effectively merge) all
// articles tagged `from` to `to`. If `to` already exists with articles, this
// is a MERGE; if `to` is new, this is a pure RENAME (which can be used to
// "include" a new theme by moving an existing one into it).
//
// theme_status of the affected rows is derived server-side from whether `to`
// is canonical — admin cannot fabricate canonicity by lying.
const Body = z.object({
  from: z
    .string()
    .transform(normalizeCandidateTheme)
    .refine((s) => s.length >= 1 && s.length <= MAX_THEME_LENGTH),
  to: z
    .string()
    .transform(normalizeCandidateTheme)
    .refine((s) => s.length >= 1 && s.length <= MAX_THEME_LENGTH),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (body.from === body.to) {
    return NextResponse.json({ error: 'noop', detail: 'from === to' }, { status: 400 });
  }

  // Service-role bypass: articles has no UPDATE RLS policy.
  const sb = getServerSupabase();
  const newStatus: 'canonical' | 'candidate' = isCanonicalTheme(body.to)
    ? 'canonical'
    : 'candidate';

  const { data, error } = await sb
    .from('articles')
    .update({ theme: body.to, theme_status: newStatus })
    .eq('theme', body.from)
    .select('id');

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({
    ok: true,
    moved: data?.length ?? 0,
    newStatus,
  });
}
