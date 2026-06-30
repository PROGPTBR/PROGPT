import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { isPro } from '@/lib/billing/subscription';
import { createProcess, listProcesses } from '@/lib/proc2pay/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — abre um processo de compra (gate Pro) ou lista os do usuário.

const ItemSchema = z.object({
  descricao: z.string().trim().min(1).max(500),
  qtd: z.coerce.number().positive().default(1),
  unidade: z.string().trim().max(20).default('un'),
  especificacao: z.string().trim().max(1000).optional(),
});

const Body = z.object({
  solicitante: z.string().trim().min(1).max(120),
  categoria: z.string().trim().max(120).optional(),
  descricao: z.string().trim().min(1).max(4000),
  itens: z.array(ItemSchema).max(100).default([]),
  prazoDesejado: z.string().trim().max(60).optional(),
  orcamentoEstimado: z.coerce.number().nonnegative().optional(),
  criticidade: z.enum(['baixa', 'media', 'alta']).optional(),
  titulo: z.string().trim().max(120).optional(),
});

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }
  const processes = await listProcesses(user.id);
  return NextResponse.json({ processes });
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  // Proc2Pay é feature Pro — o gate é a abertura do processo (não cada etapa).
  if (!(await isPro(user.id))) {
    return NextResponse.json({ error: 'paywall', plan: 'free' }, { status: 402 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const process = await createProcess({
    userId: user.id,
    titulo: parsed.titulo,
    requisicao: {
      solicitante: parsed.solicitante,
      categoria: parsed.categoria,
      descricao: parsed.descricao,
      itens: parsed.itens,
      prazoDesejado: parsed.prazoDesejado,
      orcamentoEstimado: parsed.orcamentoEstimado,
      criticidade: parsed.criticidade,
    },
    origem: 'manual',
  });
  if (!process) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });

  return NextResponse.json({ process }, { status: 201 });
}
