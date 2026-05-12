import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import {
  CANONICAL_THEMES,
  normalizeCandidateTheme,
  MAX_THEME_LENGTH,
} from '@/lib/ingest/taxonomy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/themes/demote — bulk flip canonical → candidate for every
// article with the given theme. Mirror of /promote. Useful when admin
// decides a previously-canonicalized theme should be reviewed (or the auto-
// promotion at ingest time was wrong).
//
// Themes that live in CANONICAL_THEMES (the source-of-truth constant) are
// REFUSED for demotion: those are still actively proposed by the classifier
// and being canonical-in-DB-but-candidate would create a confusing split-
// brain. To remove from the constant, edit lib/ingest/taxonomy.ts via PR.
const Body = z.object({
  theme: z
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

  if ((CANONICAL_THEMES as readonly string[]).includes(body.theme)) {
    return NextResponse.json(
      {
        error: 'protected_canonical',
        detail:
          'Tema está em CANONICAL_THEMES — edite lib/ingest/taxonomy.ts via PR para remover.',
      },
      { status: 409 },
    );
  }

  // Service-role bypass: articles has no UPDATE RLS policy.
  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('articles')
    .update({ theme_status: 'candidate' })
    .eq('theme', body.theme)
    .eq('theme_status', 'canonical')
    .select('id');

  if (error) return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, demoted: data?.length ?? 0 });
}
