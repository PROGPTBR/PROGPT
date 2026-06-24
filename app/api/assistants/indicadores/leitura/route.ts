import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { painelIndicadores, type IndicadorCard } from '@/lib/govdata/indicadores';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/assistants/indicadores/leitura — sub-projeto 37 (dashboard).
// Leitura macro CURTA, orientada a compras, fundamentada NOS números do painel
// (refetch server-side — não confia em números do client). 1 chamada LLM (tier
// generation), não-streaming. Auth + rate-limit do chat.

const SYSTEM = `Você é um economista-consultor de compras (procurement) brasileiro. Dado um quadro de indicadores macroeconômicos atuais, escreva uma LEITURA CURTA e prática para um gestor de compras.

Regras:
- Os números são INPUT — NÃO invente nem altere valores; não cite séries fora das fornecidas.
- Máximo ~5 parágrafos curtos OU bullets. Direto, sem encher linguiça.
- Cubra, quando os dados permitirem: (a) custo de capital/juros (Selic/CDI) e o que significa pro caixa e pro financiamento de fornecedores; (b) inflação e reajuste contratual — compare IPCA vs IGP-M e diga qual indexador favorece o comprador; (c) câmbio (dólar/euro) e itens importados; (d) 1-2 ações práticas (ex.: revisar cláusula de reajuste, antecipar compra de importado, renegociar prazo).
- Português brasileiro, tom de consultor sênior. Markdown limpo. Sem preâmbulo — comece pela leitura.`;

function quadro(cards: IndicadorCard[]): string {
  if (cards.length === 0) return '(sem indicadores disponíveis)';
  return cards
    .map(
      (c) =>
        `- ${c.nome}: ${c.valor.toLocaleString('pt-BR')} ${c.unidade} (em ${c.data}; tendência recente: ${c.tendencia})`,
    )
    .join('\n');
}

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

  const painel = await painelIndicadores();
  if (!painel.disponivel) {
    return NextResponse.json(
      { leitura: 'Não consegui consultar os indicadores agora. Tente novamente em instantes.' },
      { status: 200 },
    );
  }

  try {
    const model = getOpenAIModel('generation');
    const res = await getOpenAI().chat.completions.create(
      {
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: `Indicadores atuais (BACEN), atualizados em ${painel.atualizadoEm}:\n\n${quadro(painel.cards)}\n\nEscreva a leitura para compras.`,
          },
        ],
        max_completion_tokens: 900,
      },
      { signal: AbortSignal.timeout(30_000) },
    );
    const leitura = res.choices[0]?.message?.content?.trim() ?? '';
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-indicadores-leitura',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });
    return NextResponse.json({ leitura });
  } catch {
    return NextResponse.json(
      { leitura: 'Não consegui gerar a leitura agora. Tente novamente.' },
      { status: 200 },
    );
  }
}
