import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const body = await req.json();
    parsed = bodySchema.parse(body);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { ids } = parsed;
  const sb = getServerSupabase();
  const { error, count } = await sb
    .from('articles')
    .delete({ count: 'exact' })
    .in('id', ids);

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true, deleted: count ?? ids.length });
}
