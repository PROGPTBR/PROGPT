import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { painelIndicadores } from '@/lib/govdata/indicadores';
import { clearGovDataCacheByPrefix } from '@/lib/govdata/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/govdata/indicadores — sub-projeto 37 (dashboard de indicadores).
// Painel BACEN (Selic, CDI, IPCA, IGP-M, dólar, euro) com séries pro gráfico.
// Auth + rate-limit do chat. Dados cacheados 6h no server (refresh é barato).
// Fail-soft: `disponivel:false` se o BACEN não responder.

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  // "Atualizar" no dashboard manda ?refresh=1 → bypassa o cache de 1h e
  // busca o dado mais recente do BACEN (ex.: PTAX do dia já publicado).
  if (new URL(req.url).searchParams.get('refresh') === '1') {
    clearGovDataCacheByPrefix('bacen');
  }

  const painel = await painelIndicadores();
  return NextResponse.json(painel);
}
