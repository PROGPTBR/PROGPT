// Due diligence reputacional via busca web da OpenAI (Responses API, tool
// `web_search`). Sinais NÃO-oficiais (notícias, processos, recuperação
// judicial, multas) sobre o fornecedor — rotulados como indicativos.
//
// Fail-soft e desligável por chamador: cada assistente que reusa este módulo
// passa seu próprio `enabled`/`operation` (ex.: homologação usa
// HOMOLOGACAO_WEBSEARCH='false'; a Análise Financeira usa FINANCIAL_WEBSEARCH,
// backlog do diretor 2026-08-19, Batch F — pendências judiciais/protestos não
// têm API pública gratuita). Erro/timeout → segue sem o bloco. NUNCA lança.

import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage, type ApiOperation } from '@/lib/observability/api-usage';

const TIMEOUT_MS = 25_000;
const DEFAULT_OPERATION: ApiOperation = 'assistant-homologacao-reputacao';

export type ReputacaoResult = {
  enabled: boolean;
  available: boolean;
  resumo: string;
  error?: string;
};

export function isReputacaoEnabled(): boolean {
  // On por padrão; owner desliga com HOMOLOGACAO_WEBSEARCH=false (controle de custo).
  return process.env.HOMOLOGACAO_WEBSEARCH !== 'false' && !!process.env.OPENAI_API_KEY;
}

function buildPrompt(razaoSocial: string, cnpj: string, contexto: string): string {
  return `Você é um analista de due diligence. Faça uma busca web factual sobre a empresa "${razaoSocial}" (CNPJ ${cnpj}), ${contexto} no Brasil.

Resuma em até 5 bullets curtos APENAS sinais reputacionais relevantes para risco de fornecedor, SE existirem: notícias negativas, recuperação judicial/falência, processos ou condenações relevantes, multas ambientais/trabalhistas, fraude/corrupção, paralisações, problemas de entrega/qualidade noticiados.

Regras:
- Baseie-se SOMENTE no que encontrar na busca. NÃO invente. Se a confiabilidade da fonte for incerta, sinalize.
- Se NÃO encontrar nada relevante, responda EXATAMENTE: "Nenhum sinal reputacional relevante encontrado na busca web."
- Seja factual e conciso, em português brasileiro. Sem preâmbulo.`;
}

export async function buscarReputacao(input: {
  razaoSocial: string;
  cnpj: string;
  /** Override do gate padrão (isReputacaoEnabled) — cada chamador decide seu próprio flag/custo. */
  enabled?: boolean;
  /** Rótulo de custo em recordApiUsage (default: homologação, back-compat). */
  operation?: ApiOperation;
  /** Framing da busca (default: "um fornecedor em processo de homologação"). */
  contexto?: string;
}): Promise<ReputacaoResult> {
  const result: ReputacaoResult = {
    enabled: input.enabled ?? isReputacaoEnabled(),
    available: false,
    resumo: '',
  };
  if (!result.enabled) return result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const model = getOpenAIModel('routing');
    const res = await ai.responses.create(
      {
        model,
        tools: [{ type: 'web_search' } as never],
        input: buildPrompt(
          input.razaoSocial,
          input.cnpj,
          input.contexto ?? 'um fornecedor em processo de homologação',
        ),
      },
      { signal: controller.signal },
    );
    const out = (res as { output_text?: string; usage?: { input_tokens?: number; output_tokens?: number } });
    result.resumo = (out.output_text ?? '').trim();
    result.available = result.resumo.length > 0;
    // Custo: registra tokens (a sobretaxa da web search não é modelada — sub-conta
    // só esse extra; aceito pra um sinal indicativo).
    void recordApiUsage({
      provider: 'openai',
      operation: input.operation ?? DEFAULT_OPERATION,
      model,
      tokensIn: out.usage?.input_tokens ?? 0,
      tokensOut: out.usage?.output_tokens ?? 0,
      metadata: { web_search: true },
    });
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
  return result;
}
