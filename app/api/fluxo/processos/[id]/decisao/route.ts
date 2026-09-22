import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { decidirEtapa } from '@/lib/fluxo/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  decisao: z.enum(['siga', 'ajustar']),
  observacao: z.string().max(4000).optional().default(''),
});

const MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Processo não encontrado.',
  sem_pendencia: 'Não há execução aguardando decisão nesta etapa.',
  decisao_invalida: 'Decisão inválida.',
  falhou: 'Não foi possível registrar a decisão agora.',
};

// O gate humano do fluxo: SIGA avança, AJUSTAR devolve a etapa para a IA
// refazer com a correção. Nenhuma etapa avança sem passar por aqui.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let u;
  try {
    u = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  // AJUSTAR sem dizer o que corrigir faz a IA repetir o mesmo resultado.
  if (body.decisao === 'ajustar' && !body.observacao.trim()) {
    return NextResponse.json(
      { error: 'ajuste_sem_motivo', message: 'Diga o que precisa ser corrigido para a IA refazer a etapa.' },
      { status: 400 },
    );
  }

  const resultado = await decidirEtapa({
    userId: u.id,
    processoId: params.id,
    decisao: body.decisao,
    observacao: body.observacao,
  });

  if (!resultado.ok) {
    const status = resultado.reason === 'nao_encontrado' ? 404 : resultado.reason === 'falhou' ? 500 : 409;
    return NextResponse.json(
      { error: resultado.reason, message: MENSAGEM[resultado.reason] ?? 'Não foi possível decidir.' },
      { status },
    );
  }

  return NextResponse.json({ processo: resultado.processo, concluido: resultado.concluido });
}
