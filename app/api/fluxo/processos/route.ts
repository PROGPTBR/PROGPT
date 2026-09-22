import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { criarProcesso, listarProcessos } from '@/lib/fluxo/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  titulo: z.string().trim().max(200).optional().default(''),
  requisicao: z.string().trim().min(10).max(20000),
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

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Descreva a necessidade da compra (mínimo 10 caracteres).' },
      { status: 400 },
    );
  }

  const processo = await criarProcesso({
    userId: u.id,
    titulo: body.titulo || body.requisicao.slice(0, 80),
    requisicao: body.requisicao,
  });

  if (!processo) {
    return NextResponse.json(
      { error: 'persist_failed', message: 'Não foi possível abrir o processo agora.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ processo });
}
