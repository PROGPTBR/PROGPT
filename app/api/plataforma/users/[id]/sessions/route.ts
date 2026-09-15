import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/users/[id]/sessions — lista as sessões de chat de UM
// usuário, pra "Ver como o cliente" (visão de suporte, só leitura — sub-
// projeto 2026-09-15). Não abre o conteúdo das mensagens aqui (isso é
// GET .../sessions/[sessionId], que também grava o log de auditoria — abrir
// a lista não é sensível, ler o conteúdo de uma conversa é).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const { data, error } = await svc
    .from('sessions')
    .select('id, title, updated_at')
    .eq('user_id', params.id)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  return NextResponse.json({ sessions: data ?? [] });
}
