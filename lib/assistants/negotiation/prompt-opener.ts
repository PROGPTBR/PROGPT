import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { buildPersonaSystem } from './prompt-persona';
import type {
  NegotiationSimulatorSetup,
  NegotiationStrategyParams,
  NegotiationStrategyResult,
} from '@/lib/assistants/types';

// Primeira fala do fornecedor — usado pra iniciar a simulação sem
// esperar que o user fale primeiro (UX melhor: chat começa "vivo").
//
// Reusa o mesmo system prompt da persona (pra coerência) + adiciona uma
// instrução one-shot pra "abrir a conversa". 1-2 parágrafos.

const TIMEOUT_MS = 30_000;

export async function generateOpener(input: {
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  setup: NegotiationSimulatorSetup;
}): Promise<string> {
  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const systemPrompt = buildPersonaSystem(input);
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `(O comprador acabou de entrar na reunião / iniciou a conversa por mensagem. Faça a abertura como ${input.params.supplierName}. 1-2 parágrafos: cumprimento profissional + ancoragem inicial do seu lado da negociação, sem revelar limites. Nunca diga "Olá, estou pronto para negociar". Vá DIRETO ao posicionamento — exemplo do tom desejado: "Boa tarde. Antes de qualquer desconto, gostaria de entender melhor o volume que vocês projetam pros próximos 12 meses..." ou "Bom dia. Recebi o brief que vocês mandaram — preciso ser transparente: o preço que vocês colocaram como alvo está fora do que conseguimos absorver em 2026, principalmente com o reajuste de matéria-prima.")`,
          },
        ],
        max_completion_tokens: 400,
      },
      { signal: controller.signal },
    );
    const text = (res.choices[0]?.message?.content ?? '').trim();
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-opener',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });
    return text;
  } finally {
    clearTimeout(timer);
  }
}
