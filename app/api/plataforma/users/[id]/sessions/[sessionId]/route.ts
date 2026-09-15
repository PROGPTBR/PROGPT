import { NextResponse } from 'next/server';
import { requireSuperAdmin, NotSuperAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { recordAuditLog } from '@/lib/observability/audit-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/plataforma/users/[id]/sessions/[sessionId] — conteúdo (só
// leitura) de UMA conversa do cliente, pro "Ver como o cliente" do console
// Super Admin. Confirma ownership (a sessão pertence mesmo a [id]) antes de
// devolver — sem isso um super_admin poderia ler qualquer sessão trocando
// só o sessionId na URL. Cada abertura grava audit_log (`user.support_view`)
// — é o ponto mais sensível do painel (ver as conversas reais do cliente),
// então precisa ficar rastreável.
export async function GET(
  _req: Request,
  { params }: { params: { id: string; sessionId: string } },
) {
  let admin;
  try {
    admin = await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotSuperAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const svc = getServerSupabase();
  const { data, error } = await svc
    .from('sessions')
    .select('user_id, title, messages')
    .eq('id', params.sessionId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  if (!data || data.user_id !== params.id) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  void recordAuditLog({
    actorId: admin.user.id,
    actorEmail: admin.user.email,
    action: 'user.support_view',
    resourceType: 'session',
    resourceId: params.sessionId,
    metadata: { targetUserId: params.id },
  });

  return NextResponse.json({ title: data.title, messages: data.messages ?? [] });
}
