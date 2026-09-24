import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { construirPainel } from '@/lib/fluxo/metrics';
import type { FluxoEtapa, FluxoProcesso } from '@/lib/fluxo/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Painel de gestão dos processos de compra do usuário.
//
// Service-role + `.eq('user_id')` explícito nas DUAS consultas — é esse
// filtro, não a RLS, que impede um comprador de ver o processo do outro.

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const svc = getServerSupabase();

  const [{ data: processos }, { data: etapas }] = await Promise.all([
    svc
      .from('fluxo_processos')
      .select('id, user_id, titulo, requisicao, etapa_atual, status, contexto, created_at, updated_at')
      .eq('user_id', user.id),
    svc
      .from('fluxo_etapas')
      .select('id, processo_id, user_id, etapa, rodada, saida, decisao, observacao, decidida_em, created_at')
      .eq('user_id', user.id),
  ]);

  const painel = construirPainel({
    processos: (processos ?? []) as FluxoProcesso[],
    etapas: (etapas ?? []) as FluxoEtapa[],
    agora: Date.now(),
  });

  return NextResponse.json(painel);
}
