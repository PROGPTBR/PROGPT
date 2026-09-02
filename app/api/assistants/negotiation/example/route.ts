import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { pickExample } from '@/lib/assistants/negotiation/examples';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

// "✨ Gerar Exemplo" do Deal Sim (cobre a Tela 1 form do Strategy Builder +
// Tela 6 setup do Simulator). Devolve sempre o cenário default combinado
// em pickExample() (decisão do dono do produto, 2026-09-01) — não é mais
// sorteio por padrão.
//
// Query params: `kind=strategy|setup` (default `strategy`), `deal=<slug>`
// opcional — força um cenário nomeado (DEMO_SCENARIOS) específico, ou volta
// ao sorteio entre todos os casos com um valor que não exista no registro
// (ex. `?deal=sorteio`).

export async function GET(req: Request): Promise<Response> {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') === 'setup' ? 'setup' : 'strategy';
  const deal = url.searchParams.get('deal');

  const pick = pickExample(kind, deal);
  void recordApiUsage({
    provider: 'openai',
    operation: 'assistant-negotiation-example',
    metadata: { kind, id: pick?.id ?? null, deal: deal ?? null },
  });
  return NextResponse.json(pick);
}
