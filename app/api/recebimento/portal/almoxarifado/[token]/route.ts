import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { atestarRecebimento, getPedidoPorToken, registrarEntrada, visaoAlmoxarifado } from '@/lib/recebimento/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Conferência física do almoxarifado pelo link (sub-projeto 95). Rota
// PÚBLICA, protegida pelo token. A resposta é a visão SEM VALORES.
const Body = z.discriminatedUnion('acao', [
  z.object({
    acao: z.literal('entrada'),
    responsavel: z.string().trim().min(1).max(120),
    observacao: z.string().max(2000).default(''),
    notaId: z.string().uuid().nullable().default(null),
    itens: z
      .array(z.object({ item: z.number().int().min(0).max(299), quantidade: z.number().min(0).max(1e9), ressalva: z.string().max(500).default('') }))
      .min(1)
      .max(300),
  }),
  z.object({ acao: z.literal('atestar'), responsavel: z.string().trim().min(1).max(120), confirmo: z.literal(true) }),
]);

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const rate = await checkAnonRateLimit('recebimento-portal', hashIp(getClientIp(req)), 10, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Informe o seu nome e as quantidades recebidas.' }, { status: 400 });
  }

  const c = await getPedidoPorToken('almoxarifado', params.token);
  if (!c) return NextResponse.json({ error: 'not_found', message: 'Este link não é válido.' }, { status: 404 });

  const r =
    body.acao === 'entrada'
      ? await registrarEntrada({ completo: c, itens: body.itens, responsavel: body.responsavel, observacao: body.observacao, notaId: body.notaId })
      : await atestarRecebimento({ completo: c, responsavel: body.responsavel });

  if (!r.ok) return NextResponse.json({ error: 'recusado', message: r.erro }, { status: 409 });
  return NextResponse.json({ ok: true, visao: visaoAlmoxarifado(r.completo) });
}
