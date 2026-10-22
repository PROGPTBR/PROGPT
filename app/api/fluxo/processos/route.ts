import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { criarProcesso, listarProcessos } from '@/lib/fluxo/process';
import { usuarioComFluxo, respostaSobDemanda } from '@/lib/fluxo/acesso-servidor';
import { emailValido, notificarSolicitante } from '@/lib/fluxo/notificacoes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  titulo: z.string().trim().max(200).optional().default(''),
  requisicao: z.string().trim().min(10).max(20000),
  // Quem pediu a compra: recebe o link de acompanhamento e um aviso a cada
  // etapa (sub-projeto 90). Opcional.
  solicitanteNome: z.string().trim().max(120).optional().default(''),
  solicitanteEmail: z.string().trim().max(200).optional().default(''),
});

async function user() {
  return requireUser();
}

export async function GET() {
  let u;
  try {
    u = await user();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  return NextResponse.json({ processos: await listarProcessos(u.id) });
}

export async function POST(req: Request) {
  let u;
  try {
    u = await user();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  if (!(await usuarioComFluxo(u))) return respostaSobDemanda();

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Descreva a necessidade da compra (mínimo 10 caracteres).' },
      { status: 400 },
    );
  }

  if (body.solicitanteEmail && !emailValido(body.solicitanteEmail)) {
    return NextResponse.json(
      { error: 'email_invalido', message: 'Confira o e-mail de quem pediu a compra.' },
      { status: 400 },
    );
  }

  const processo = await criarProcesso({
    userId: u.id,
    titulo: body.titulo || body.requisicao.slice(0, 80),
    requisicao: body.requisicao,
    solicitanteNome: body.solicitanteNome,
    solicitanteEmail: body.solicitanteEmail,
  });

  if (!processo) {
    return NextResponse.json(
      { error: 'persist_failed', message: 'Não foi possível abrir o processo agora.' },
      { status: 500 },
    );
  }

  if (processo.solicitante_email) void notificarSolicitante({ processo });

  return NextResponse.json({ processo });
}
