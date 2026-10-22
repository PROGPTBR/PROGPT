import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { configurarAcompanhamento } from '@/lib/fluxo/acompanhamento';
import { usuarioComFluxo, respostaSobDemanda } from '@/lib/fluxo/acesso-servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Link de acompanhamento de quem pediu a compra (sub-projeto 90). Devolve o
// link (cria se o processo for anterior à Fase 1) e, com o contato do
// solicitante, grava e envia o link para ele.
const Body = z.object({
  solicitanteNome: z.string().max(120).optional(),
  solicitanteEmail: z.string().max(200).optional(),
  enviar: z.boolean().optional().default(false),
});

const MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Processo não encontrado.',
  email_invalido: 'Confira o e-mail de quem pediu a compra.',
  falhou: 'Não foi possível salvar agora. Tente de novo.',
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let u;
  try {
    u = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }
  if (!(await usuarioComFluxo(u))) return respostaSobDemanda();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const r = await configurarAcompanhamento({ userId: u.id, processoId: params.id, ...body });
  if (!r.ok) {
    const status = r.reason === 'nao_encontrado' ? 404 : r.reason === 'email_invalido' ? 400 : 500;
    return NextResponse.json({ error: r.reason, message: MENSAGEM[r.reason] }, { status });
  }
  return NextResponse.json({ link: r.link, processo: r.processo, enviado: r.enviado });
}
