import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { STRATEGY_EXAMPLES, SIMULATOR_SETUP_EXAMPLES } from '@/lib/assistants/negotiation/examples';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

// "✨ Gerar Exemplo" do Deal Sim. V1 retorna um dos cases pre-curados
// random (cobre a Tela 1 form do Strategy Builder + Tela 6 setup do
// Simulator). V2 pode gerar via LLM dinamicamente.
//
// Query param `kind=strategy|setup` (default `strategy`).

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

  if (kind === 'setup') {
    const pick =
      SIMULATOR_SETUP_EXAMPLES[
        Math.floor(Math.random() * SIMULATOR_SETUP_EXAMPLES.length)
      ];
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-example',
      metadata: { kind, id: pick?.id ?? null },
    });
    return NextResponse.json(pick);
  }

  const pick =
    STRATEGY_EXAMPLES[Math.floor(Math.random() * STRATEGY_EXAMPLES.length)];
  void recordApiUsage({
    provider: 'openai',
    operation: 'assistant-negotiation-example',
    metadata: { kind, id: pick?.id ?? null },
  });
  return NextResponse.json(pick);
}
