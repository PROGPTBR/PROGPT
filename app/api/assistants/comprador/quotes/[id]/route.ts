import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — uma cotação (com a análise completa) + suas respostas.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { data: quote, error } = await svc
    .from('comprador_quotes')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  if (!quote) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: replies } = await svc
    .from('comprador_replies')
    .select('*')
    .eq('quote_id', params.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ quote, replies: replies ?? [] });
}

// DELETE — remove a cotação (cascade nas respostas).
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { error } = await svc
    .from('comprador_quotes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
