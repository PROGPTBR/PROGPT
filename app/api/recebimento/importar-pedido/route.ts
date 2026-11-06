import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkChatRateLimit } from '@/lib/rate-limit';
import { extrairPedidoDoTexto } from '@/lib/recebimento/extrair';
import { usuarioOu401 } from '@/lib/recebimento/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lê um pedido de compra (texto extraído do PDF/Word/Excel pelo importador do
// Equalizador, ou colado) e devolve os campos para o comprador conferir.
const Body = z.object({ texto: z.string().trim().min(20).max(120_000) });

export async function POST(req: Request) {
  const u = await usuarioOu401();
  if (u instanceof NextResponse) return u;

  const rate = await checkChatRateLimit();
  if (!rate.allowed) {
    return NextResponse.json({ error: 'rate_limited', message: 'Muitas leituras seguidas. Aguarde um minuto.' }, { status: 429 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', message: 'Cole o pedido ou importe o arquivo.' }, { status: 400 });
  }

  try {
    const pedido = await extrairPedidoDoTexto(body.texto, u.id);
    if (pedido.itens.length === 0) {
      return NextResponse.json({ error: 'sem_itens', message: 'Não encontramos itens neste documento.' }, { status: 422 });
    }
    return NextResponse.json({ pedido });
  } catch (err) {
    console.error('[recebimento] importar pedido falhou:', err);
    return NextResponse.json({ error: 'falhou', message: 'Não foi possível ler o pedido agora.' }, { status: 500 });
  }
}
