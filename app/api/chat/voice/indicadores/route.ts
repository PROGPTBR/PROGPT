import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { indicadoresAtuais, resumoIndicadores } from '@/lib/govdata/indicadores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/chat/voice/indicadores — sub-projeto 37 (fase 3).
// Executor da tool `consultar_indicadores_economicos` da sessão de voz realtime:
// devolve um RESUMO FALÁVEL curto (Selic + IPCA 12m + dólar) pro modelo narrar.
// Auth + rate-limit do chat. Fail-soft: sempre 200 com `resumo`.

export async function POST(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  const ind = await indicadoresAtuais();
  return NextResponse.json({ resumo: resumoIndicadores(ind) });
}
