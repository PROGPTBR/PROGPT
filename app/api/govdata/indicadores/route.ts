import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { painelIndicadores } from '@/lib/govdata/indicadores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/govdata/indicadores — sub-projeto 37 (dashboard de indicadores).
// Painel BACEN (Selic, CDI, IPCA, IGP-M, dólar, euro) com séries pro gráfico.
// Auth + rate-limit do chat. Dados cacheados 6h no server (refresh é barato).
// Fail-soft: `disponivel:false` se o BACEN não responder.

export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  const painel = await painelIndicadores();
  return NextResponse.json(painel);
}
