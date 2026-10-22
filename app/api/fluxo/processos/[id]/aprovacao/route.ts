import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { cancelarAprovacoesPendentes, listarAprovacoes, pedirAprovacao } from '@/lib/fluxo/acompanhamento';
import { usuarioComFluxo, respostaSobDemanda } from '@/lib/fluxo/acesso-servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Aprovação do gestor por e-mail (sub-projeto 90). GET lista os pedidos do
// processo (sem o token, que só vai no e-mail do gestor); POST pede a
// aprovação da etapa que está aguardando decisão; DELETE cancela o pedido aberto.
const Body = z.object({
  aprovadorNome: z.string().max(120).optional().default(''),
  aprovadorEmail: z.string().max(200),
});

const MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Processo não encontrado.',
  sem_pendencia: 'Execute a etapa primeiro: o gestor aprova o resultado que a IA gerou.',
  email_invalido: 'Confira o e-mail do gestor.',
  falhou: 'Não foi possível enviar agora. Tente de novo.',
};

async function autenticar() {
  try {
    return await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return null;
    throw err;
  }
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await autenticar();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await usuarioComFluxo(u))) return respostaSobDemanda();
  return NextResponse.json({ aprovacoes: await listarAprovacoes(u.id, params.id) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const u = await autenticar();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await usuarioComFluxo(u))) return respostaSobDemanda();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: MENSAGEM.email_invalido }, { status: 400 });
  }

  const r = await pedirAprovacao({ userId: u.id, processoId: params.id, ...body });
  if (!r.ok) {
    const status =
      r.reason === 'nao_encontrado' ? 404 : r.reason === 'email_invalido' ? 400 : r.reason === 'sem_pendencia' ? 409 : 500;
    return NextResponse.json({ error: r.reason, message: MENSAGEM[r.reason] }, { status });
  }
  return NextResponse.json({ aprovacao: r.aprovacao, enviado: r.enviado });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const u = await autenticar();
  if (!u) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!(await usuarioComFluxo(u))) return respostaSobDemanda();
  await cancelarAprovacoesPendentes(u.id, params.id);
  return NextResponse.json({ ok: true });
}
