import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { pickExample } from '@/lib/assistants/negotiation/examples';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

// "✨ Gerar Exemplo" do Deal Sim. V1 retorna um dos cases pre-curados
// random (cobre a Tela 1 form do Strategy Builder + Tela 6 setup do
// Simulator). V2 pode gerar via LLM dinamicamente.
//
// Query params: `kind=strategy|setup` (default `strategy`), `deal=<slug>`
// opcional — força um cenário nomeado (DEMO_SCENARIOS) em vez do sorteio,
// pra demos/apresentações onde o resultado precisa ser determinístico.

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
