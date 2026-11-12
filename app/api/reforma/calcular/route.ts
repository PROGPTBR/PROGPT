import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { CalculadoraErro } from '@/lib/reforma/calculadora';
import { calcularCenarios } from '@/lib/reforma/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  uf: z.string().regex(/^[A-Za-z]{2}$/),
  municipio: z.number().int().min(1000000).max(9999999),
  regime: z.enum(['regular', 'simples']),
  referencia: z.object({ cbs: z.number().min(0).max(30), ibs: z.number().min(0).max(40) }),
  itens: z
    .array(
      z.object({
        descricao: z.string().trim().max(300),
        ncm: z.string().trim().max(12),
        cst: z.string().regex(/^\d{3}$/),
        cClassTrib: z.string().regex(/^\d{6}$/),
        valor: z.number().positive().max(1e11),
        quantidade: z.number().positive().max(1e9).optional(),
        unidade: z.string().max(10).optional(),
        destacado: z.object({ cbs: z.number().nullable(), ibs: z.number().nullable() }).optional(),
      }),
    )
    .min(1)
    .max(100),
});

export async function POST(req: Request) {
  if (!(await getCurrentUser())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const rate = await checkChatRateLimit();
  if (!rate.allowed) return NextResponse.json({ error: 'rate_limited', message: 'Muitos cálculos seguidos. Aguarde um minuto.' }, { status: 429 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Confira os itens: valor, classificação e local.' }, { status: 400 });
  }

  try {
    const resultado = await calcularCenarios({ ...body, uf: body.uf.toUpperCase() });
    return NextResponse.json(resultado);
  } catch (err) {
    if (err instanceof CalculadoraErro && err.status < 500) {
      return NextResponse.json(
        { error: 'recusado', message: `A calculadora oficial recusou o cálculo: ${err.detalhe ?? 'dados inválidos'}` },
        { status: 400 },
      );
    }
    console.error('[reforma] calcular falhou:', err);
    return NextResponse.json(
      { error: 'indisponivel', message: 'A calculadora oficial da Receita não respondeu agora. Tente de novo em instantes.' },
      { status: 502 },
    );
  }
}
