import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { supabaseServer } from '@/lib/db/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }
  const sb = supabaseServer();
  const { error } = await sb.from('articles').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
