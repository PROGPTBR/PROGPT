import { NextResponse } from 'next/server';

import { movimentoDoEvento, registrarMovimento, segredoDoWebhookConfere } from '@/lib/medico/btg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/medico/btg/webhook: aviso do BTG de crédito ou débito em conta.
// O banco espera resposta em até 10 s e tenta mais 3 vezes em 10 min; o
// mesmo movimento nunca é gravado duas vezes (transactionId único).
export async function POST(req: Request) {
  if (!segredoDoWebhookConfere(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const movimento = movimentoDoEvento(await req.json().catch(() => null));
  if (!movimento) return NextResponse.json({ ok: true, ignored: true });
  try {
    return NextResponse.json({ ok: true, resultado: await registrarMovimento(movimento) });
  } catch (err) {
    console.error('[medico/btg] webhook:', err instanceof Error ? err.message : err);
    // 500 faz o BTG tentar de novo.
    return NextResponse.json({ error: 'falhou' }, { status: 500 });
  }
}
