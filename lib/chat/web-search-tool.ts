// Tool de busca na web compartilhada entre o Assistente Pessoal
// (lib/chat/personal-assistant.ts) e o chat principal (app/api/chat/route.ts,
// usada junto com a tool `responder_fora_do_escopo` — ver
// lib/chat/inline-chat-tools.ts). `execute()` chama o MESMO shape já
// comprovado em lib/fiscal/reputacao.ts (openai.responses.create com o tool
// hospedado `web_search`, não-streaming) — reaproveitado aqui via
// function-calling comum do AI SDK, não o tool hospedado da Responses API
// diretamente (zero precedente de tool-calling nativo do AI SDK neste repo
// antes do Assistente Pessoal, mas function-calling comum é bem mais estável
// que apostar em suporte a hosted tools na versão do AI SDK travada aqui).

import { tool } from 'ai';
import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage, type ApiOperation } from '@/lib/observability/api-usage';

const WEBSEARCH_TIMEOUT_MS = 25_000;

export function createWebSearchTool(ctx: {
  sessionId?: string;
  usedRef: { current: boolean };
  /** Label de custo — cada chamador (Assistente Pessoal, chat principal) usa o seu, mesmo padrão de lib/fiscal/reputacao.ts. */
  operation: ApiOperation;
}) {
  return tool({
    description:
      'Busca informações atuais na web: notícias, placares de jogos, cotações, preços, eventos recentes, ou qualquer fato que possa ter mudado depois do seu treinamento. Use sempre que a pergunta for sobre algo atual/tempo-sensível ou você não tiver certeza.',
    parameters: z.object({
      query: z.string().describe('A busca em linguagem natural que trará os melhores resultados.'),
    }),
    execute: async ({ query }: { query: string }) => {
      ctx.usedRef.current = true;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), WEBSEARCH_TIMEOUT_MS);
      try {
        const ai = getOpenAI();
        // Extração factual curta, não prosa — tier barato, mesmo critério de
        // lib/fiscal/reputacao.ts.
        const model = getOpenAIModel('routing');
        const res = await ai.responses.create(
          { model, tools: [{ type: 'web_search' } as never], input: query },
          { signal: controller.signal },
        );
        const out = res as {
          output_text?: string;
          usage?: { input_tokens?: number; output_tokens?: number };
        };
        void recordApiUsage({
          provider: 'openai',
          operation: ctx.operation,
          model,
          tokensIn: out.usage?.input_tokens ?? 0,
          tokensOut: out.usage?.output_tokens ?? 0,
          metadata: { web_search: true, session_id: ctx.sessionId ?? null },
        });
        return (
          (out.output_text ?? '').trim() || 'Nenhum resultado relevante encontrado na busca.'
        );
      } catch (err) {
        // Fail-soft: NUNCA lançar de dentro de execute() — abortaria o
        // stream inteiro. Devolve uma explicação pro modelo seguir sem a
        // busca.
        const msg = err instanceof Error ? err.message : String(err);
        return `A busca ao vivo falhou (${msg}). Responda com seu conhecimento geral e avise que não conseguiu confirmar com uma fonte atual.`;
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
