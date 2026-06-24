import { z } from 'zod';
import { getOpenAI, getOpenAIModel, withRateLimitRetry } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { SPEND_CATEGORIES, coerceSpendCategory } from './taxonomy';
import { mapWithConcurrency } from './concurrency';

// Classificação de categoria das invoices que ficaram sem categoria (extração
// que falhou, ou linhas de planilha sem coluna de categoria). Roda no tier
// barato (routing/gpt-4o-mini) em lotes — alto volume, JSON curto.

const BATCH = 25;
const CONCURRENCY = 3;
const TIMEOUT_MS = 45_000;

export type ClassifyItem = {
  id: string;
  description: string | null;
  supplier: string | null;
};

export type ClassifyOutcome = { category: string; justification: string };

const ResultSchema = z.object({
  itens: z.array(
    z.object({
      id: z.string(),
      categoria: z.string(),
      justificativa: z.string().optional().default(''),
    }),
  ),
});

function buildSystemPrompt(): string {
  return `Você é um analista de compras classificando gastos por categoria.

Para CADA item recebido (com id, fornecedor e descrição), atribua UMA categoria EXATAMENTE desta lista:
${SPEND_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Regras:
- Use o nome EXATO da categoria (copie da lista). "Outros" só como último recurso.
- "justificativa": 1 frase curta com o critério.
- Responda EXCLUSIVAMENTE com JSON: { "itens": [ { "id": "...", "categoria": "...", "justificativa": "..." } ] }
- Inclua TODOS os ids recebidos, na mesma ordem.`;
}

async function classifyBatch(items: ClassifyItem[]): Promise<Map<string, ClassifyOutcome>> {
  const out = new Map<string, ClassifyOutcome>();
  if (items.length === 0) return out;

  const userPayload = items.map((it) => ({
    id: it.id,
    fornecedor: (it.supplier ?? '').slice(0, 120),
    descricao: (it.description ?? '').slice(0, 300),
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const model = getOpenAIModel('routing');
    const res = await withRateLimitRetry(
      () =>
        ai.chat.completions.create(
          {
            model,
            messages: [
              { role: 'system', content: buildSystemPrompt() },
              { role: 'user', content: JSON.stringify({ itens: userPayload }) },
            ],
            response_format: { type: 'json_object' },
            max_completion_tokens: 1500,
          },
          { signal: controller.signal },
        ),
      controller.signal,
      'spend/classify',
    );

    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-spend-classify',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: { count: items.length },
    });

    const raw = res.choices[0]?.message?.content ?? '';
    const parsed = ResultSchema.parse(JSON.parse(raw));
    for (const r of parsed.itens) {
      const category = coerceSpendCategory(r.categoria) ?? 'Outros';
      out.set(r.id, { category, justification: (r.justificativa ?? '').slice(0, 240) });
    }
  } catch {
    // fail-soft: itens não classificados ficam de fora; o caller usa 'Outros'.
  } finally {
    clearTimeout(timer);
  }
  return out;
}

/** Classifica todos os itens em lotes concorrentes. Itens sem resposta caem
 *  em 'Outros' no caller. */
export async function classifyCategories(
  items: ClassifyItem[],
): Promise<Map<string, ClassifyOutcome>> {
  if (items.length === 0) return new Map();
  const batches: ClassifyItem[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  const maps = await mapWithConcurrency(batches, CONCURRENCY, (b) => classifyBatch(b));
  const merged = new Map<string, ClassifyOutcome>();
  for (const m of maps) for (const [k, v] of m) merged.set(k, v);
  return merged;
}
