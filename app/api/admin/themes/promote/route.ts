import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/db/supabase-server';
import { normalizeCandidateTheme, MAX_THEME_LENGTH } from '@/lib/ingest/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Promote a candidate theme to canonical for ALL articles currently tagged
// with it. This is the bulk path — single-article toggles still go through
// PATCH /api/admin/articles/[id].
//
// Note: this only flips theme_status. The CANONICAL_THEMES list in
// lib/ingest/taxonomy.ts does NOT update — it's the source of truth for the
// classifier prompt. So a promoted candidate becomes "canonical for retrieval
// purposes" but the classifier won't actively pick it on new ingestion until
// the constant is updated (deliberate: admin reviews periodically and adds
// stabilized themes to the constant via PR).
const Body = z.object({
  theme: z
    .string()
    .transform(normalizeCandidateTheme)
    .refine((s) => s.length >= 1 && s.length <= MAX_THEME_LENGTH, {
      message: `theme must be 1–${MAX_THEME_LENGTH} chars`,
    }),
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

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('articles')
    .update({ theme_status: 'canonical' })
    .eq('theme', body.theme)
    .eq('theme_status', 'candidate')
    .select('id');

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, promoted: data?.length ?? 0 });
}
