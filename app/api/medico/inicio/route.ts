import { NextResponse } from 'next/server';
import { z } from 'zod';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { faltaNoInicio } from '@/lib/medico/inicio';
import { carregarEstado, salvarConfig } from '@/lib/medico/service';
import { ConfigSchema } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Formulário de início (sub-projeto 117).
//   PUT: salva um pedaço das respostas (a cada passo, para não perder nada).
//   POST { acao: 'concluir' | 'pular' }: fecha o formulário. Concluir exige as
//   respostas obrigatórias; pular deixa o app aberto e o formulário volta
//   pelos primeiros passos.

const Fechar = z.object({ acao: z.enum(['concluir', 'pular']) });

export async function PUT(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = ConfigSchema.partial().safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Confira os dados.' }, { status: 400 });
  if (!(await salvarConfig(u.id, body.data))) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = Fechar.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Pedido inválido.' }, { status: 400 });
  if (body.data.acao === 'concluir') {
    const faltam = faltaNoInicio(await carregarEstado(u.id));
    if (faltam.length > 0) return NextResponse.json({ error: 'incompleto', message: 'Ainda falta responder alguma coisa.', faltam }, { status: 409 });
  }
  const ok = await salvarConfig(u.id, { inicio_status: body.data.acao === 'concluir' ? 'respondido' : 'pulado', inicio_em: new Date().toISOString() });
  if (!ok) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
