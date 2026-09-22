import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { rodarEtapa } from '@/lib/fluxo/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  entrada: z.string().max(60000).optional().default(''),
});

const MENSAGEM: Record<string, string> = {
  nao_encontrado: 'Processo não encontrado.',
  etapa_invalida: 'Etapa desconhecida neste processo.',
  fora_de_ordem: 'Conclua a etapa anterior antes desta.',
  ja_pendente: 'Esta etapa já foi executada e aguarda sua decisão.',
  encerrado: 'Este processo já foi encerrado.',
  falhou: 'Não foi possível executar a etapa agora. Tente de novo em instantes.',
};

// Roda a etapa atual. Gasta chamada de IA, então divide o balde de
// rate-limit do chat — sem limite próprio novo.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let u;
  try {
    u = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const limite = await checkChatRateLimit();
  if (!limite.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Muitas execuções seguidas. Aguarde um instante.' },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const resultado = await rodarEtapa({
    userId: u.id,
    processoId: params.id,
    entrada: body.entrada,
  });

  if (!resultado.ok) {
    const status = resultado.reason === 'nao_encontrado' ? 404 : resultado.reason === 'falhou' ? 500 : 409;
    return NextResponse.json(
      { error: resultado.reason, message: MENSAGEM[resultado.reason] ?? 'Não foi possível executar.' },
      { status },
    );
  }

  return NextResponse.json({ etapa: resultado.etapa });
}
