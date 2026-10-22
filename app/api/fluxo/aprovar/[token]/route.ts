import { NextResponse } from 'next/server';
import { z } from 'zod';

import { decidirAprovacao } from '@/lib/fluxo/acompanhamento';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { getClientIp, hashIp } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Decisão do gestor pelo link do e-mail (sub-projeto 90). Rota PÚBLICA: o
// gestor não tem conta. O token (32 bytes, uso único, com validade) é a
// credencial; o rate-limit por IP limita tentativa de adivinhação.
const Body = z.object({
  decisao: z.enum(['aprovar', 'reprovar']),
  comentario: z.string().max(4000).optional().default(''),
});

const MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Este link não é válido.',
  indisponivel: 'Este pedido de aprovação não está mais aberto.',
  sem_motivo: 'Diga o motivo da reprovação, para o comprador saber o que corrigir.',
  falhou: 'Não foi possível registrar agora. Tente de novo em instantes.',
};

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const rate = await checkAnonRateLimit('fluxo-aprovacao', hashIp(getClientIp(req)), 5, 30);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Dados inválidos.' }, { status: 400 });
  }

  const r = await decidirAprovacao({
    token: params.token,
    aprovado: body.decisao === 'aprovar',
    comentario: body.comentario,
  });

  if (!r.ok) {
    const status =
      r.reason === 'nao_encontrado' ? 404 : r.reason === 'sem_motivo' ? 400 : r.reason === 'indisponivel' ? 409 : 500;
    return NextResponse.json({ error: r.reason, estado: r.estado, message: MENSAGEM[r.reason] }, { status });
  }
  return NextResponse.json({ ok: true, aprovado: r.aprovado });
}
