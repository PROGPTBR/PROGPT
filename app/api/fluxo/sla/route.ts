import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { FLUXO_STAGE_IDS, isFluxoStageId } from '@/lib/fluxo/stages';
import type { SlaPorEtapa } from '@/lib/fluxo/metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Metas de SLA por etapa, definidas pelo próprio cliente.
//
// PUT recebe o conjunto inteiro (as 8 etapas) — é um formulário salvo de uma
// vez, não edição campo a campo, então o upsert em lote evita estado
// intermediário inconsistente.

const MAX_HORAS = 8760; // um ano

const Body = z.object({
  slas: z.record(z.string(), z.number().int().min(0).max(MAX_HORAS)),
});

async function usuario() {
  return requireUser();
}

export async function GET() {
  let user;
  try {
    user = await usuario();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const { data } = await getServerSupabase()
    .from('fluxo_slas')
    .select('etapa, prazo_horas')
    .eq('user_id', user.id);

  const slas: SlaPorEtapa = {};
  for (const linha of (data ?? []) as Array<{ etapa: string; prazo_horas: number }>) {
    if (isFluxoStageId(linha.etapa)) slas[linha.etapa] = linha.prazo_horas;
  }

  return NextResponse.json({ slas });
}

export async function PUT(req: Request) {
  let user;
  try {
    user = await usuario();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Informe o prazo em horas de cada etapa.' },
      { status: 400 },
    );
  }

  // Só etapas que existem — o cliente não define SLA de etapa inventada.
  const linhas = FLUXO_STAGE_IDS.filter((id) => id in body.slas).map((id) => ({
    user_id: user.id,
    etapa: id,
    prazo_horas: Math.max(0, Math.min(MAX_HORAS, Math.trunc(body.slas[id] ?? 0))),
    updated_at: new Date().toISOString(),
  }));

  if (linhas.length === 0) {
    return NextResponse.json(
      { error: 'nenhuma_etapa', message: 'Nenhuma etapa válida foi enviada.' },
      { status: 400 },
    );
  }

  const { error } = await getServerSupabase()
    .from('fluxo_slas')
    .upsert(linhas, { onConflict: 'user_id,etapa' });

  if (error) {
    console.error('[fluxo/sla] upsert falhou:', error.message);
    return NextResponse.json(
      { error: 'persist_failed', message: 'Não foi possível salvar as metas agora.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, etapas: linhas.length });
}
