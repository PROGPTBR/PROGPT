// Assistente Pessoal — modo livre do /chat, sem restrição de domínio de
// procurement. Toggle no Composer manda `mode: 'personal'` no body do MESMO
// endpoint /api/chat (não uma rota nova — trocar a `api` do useChat quebraria
// o cache SWR interno do hook, ver plano). app/api/chat/route.ts despacha pra
// cá logo após a autenticação, antes de qualquer coisa RAG-específica.
//
// Busca na web: a resposta externa (streamText, visível ao usuário) usa
// function-calling comum do AI SDK com uma tool `web_search`, cujo execute()
// chama por baixo o MESMO shape já comprovado em lib/fiscal/reputacao.ts
// (openai.responses.create com o tool hospedado `web_search`, não-streaming).

import { tool, streamText, StreamData } from 'ai';
import { z } from 'zod';
import { getOpenAI, getOpenAIModel, getStreamingOpenAI } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { checkPersonalChatRateLimit } from '@/lib/rate-limit';
import type { ChatMessage } from '@/lib/rag/types';

const WEBSEARCH_TIMEOUT_MS = 25_000;

export function isPersonalChatEnabled(): boolean {
  return process.env.PERSONAL_CHAT_ENABLED !== 'false';
}

export function isPersonalWebSearchEnabled(): boolean {
  return process.env.PERSONAL_CHAT_WEBSEARCH !== 'false' && !!process.env.OPENAI_API_KEY;
}

const PERSONAL_SYSTEM_PROMPT = `Você é o Assistente Pessoal do PROGPT — um modo de conversa livre, sem restrição de domínio.

Diferente do assistente principal de procurement, você NÃO está limitado a compras, licitações ou
fornecedores. Responda a QUALQUER pergunta: esportes, notícias, curiosidades, cálculos, dúvidas do
dia a dia, conversa casual — o que o usuário perguntar.

Regras:
1. Seja direto, útil e conversacional. Sem jargão de procurement, sem preâmbulo desnecessário.
2. Você tem uma ferramenta de busca na web (\`web_search\`). Use-a sempre que a pergunta envolver
   algo atual ou tempo-sensível: placares de jogos, notícias recentes, cotações, preços, eventos,
   ou qualquer fato que possa ter mudado depois do seu treinamento. Na dúvida sobre se a
   informação ainda é válida, busque — não adivinhe.
3. Quando usar a busca, baseie sua resposta no que ela retornou. Se a busca falhar ou não
   encontrar nada, diga isso claramente e responda com seu conhecimento geral, deixando claro que
   não conseguiu confirmar com uma fonte atual.
4. Você NÃO tem a regra de "não tenho fonte sobre isso" do assistente de procurement — aqui você
   sempre tenta ajudar, mesmo sem fonte, usando seu conhecimento geral quando a busca não se
   aplica (ex.: "explique como funciona X", matemática, tradução, etc.).
5. Português brasileiro por padrão; responda em outro idioma se o usuário escrever nele.
6. Seja honesto sobre incerteza. Não invente placares, números ou fatos — se não tiver certeza e a
   busca não ajudou, diga que não tem certeza.`;

function createWebSearchTool(ctx: { sessionId?: string; usedRef: { current: boolean } }) {
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
          operation: 'chat-personal-websearch',
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
        // busca (a regra 3 do system prompt instrui ele a avisar o usuário).
        const msg = err instanceof Error ? err.message : String(err);
        return `A busca ao vivo falhou (${msg}). Responda com seu conhecimento geral e avise que não conseguiu confirmar com uma fonte atual.`;
      } finally {
        clearTimeout(timer);
      }
    },
  });
}

export async function handlePersonalChatTurn(input: {
  userId: string;
  messages: ChatMessage[];
  sessionId?: string;
}): Promise<Response> {
  if (!isPersonalChatEnabled()) {
    return Response.json({ error: 'personal_chat_disabled' }, { status: 404 });
  }

  const rl = await checkPersonalChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'chat.personal.turn',
    userId: input.userId,
    sessionId: input.sessionId,
    input: { messages: input.messages },
    tags: [`env:${env}`, 'mode:personal'],
  });

  const usedRef = { current: false };
  const tools = isPersonalWebSearchEnabled()
    ? { web_search: createWebSearchTool({ sessionId: input.sessionId, usedRef }) }
    : undefined;

  const data = new StreamData();
  const openai = getStreamingOpenAI();
  // Resposta lida diretamente pelo usuário — mesmo tier de qualidade do
  // chat-generate procurement (isolado de 'routing', que fica reservado pra
  // classify/condense/followups/title — ver lib/llm/openai.ts).
  const model = getOpenAIModel('generation');

  try {
    const result = streamText({
      model: openai(model),
      temperature: 0.7,
      system: PERSONAL_SYSTEM_PROMPT,
      messages: input.messages,
      tools,
      maxSteps: tools ? 4 : 1,
      onFinish: async ({ text, usage, finishReason }) => {
        data.appendMessageAnnotation({ mode: 'personal', webSearchUsed: usedRef.current });
        void recordApiUsage({
          provider: 'openai',
          operation: 'chat-personal-generate',
          model,
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          metadata: {
            web_search_used: usedRef.current,
            finish_reason: finishReason,
            env,
            session_id: input.sessionId ?? null,
          },
        });
        trace.setTag(usedRef.current ? 'websearch:used' : 'websearch:unused');
        const aborted = finishReason === 'error';
        trace.end({ answer: text, finishReason }, aborted ? 'WARNING' : 'DEFAULT');
        await flushAsync();
        data.close();
      },
    });

    return result.toDataStreamResponse({ data });
  } catch (err) {
    console.error('[personal-assistant] failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'personal_chat_failed' }, { status: 500 });
  }
}
