import { NextResponse } from 'next/server';

import { getClientIp, hashIp } from '@/lib/captcha';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { getPedidoPorToken, registrarNota } from '@/lib/recebimento/service';
import { lerUploadDaNota, respostaDeErroDaNota } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// O fornecedor anexa a nota pelo link do pedido (sub-projeto 95). Rota
// PÚBLICA: o token (32 bytes) é a credencial; o rate-limit por IP segura
// tentativa de adivinhação e o custo da leitura por IA de PDF.
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const rate = await checkAnonRateLimit('recebimento-portal', hashIp(getClientIp(req)), 6, 40);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitos envios seguidos. Aguarde um minuto.' }, { status: 429 });
  }

  const c = await getPedidoPorToken('fornecedor', params.token);
  if (!c) return NextResponse.json({ error: 'not_found', message: 'Este link não é válido.' }, { status: 404 });

  const up = await lerUploadDaNota(req);
  if (up instanceof NextResponse) return up;

  try {
    const r = await registrarNota({ completo: c, arquivo: up.arquivo, finalidade: up.finalidade, enviadoPor: 'fornecedor' });
    // Ao fornecedor só volta o recibo: a conferência é interna do comprador.
    return NextResponse.json({ ok: true, numero: r.nota.numero, finalidade: r.nota.finalidade });
  } catch (err) {
    return respostaDeErroDaNota(err);
  }
}
