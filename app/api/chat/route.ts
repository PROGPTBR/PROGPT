import { z } from 'zod';
import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { requireEnv } from '@/lib/env';
import { runRag } from '@/lib/rag';
import { condenseQuery } from '@/lib/rag/condenser';
import { suggestFollowups } from '@/lib/rag/followups';
import type { ChatMessage, ProfileSnapshot } from '@/lib/rag/types';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { summarizeChatTitle } from '@/lib/chat-title';
import { getServerSupabase } from '@/lib/db/supabase';
import type { TraceLevel } from '@/lib/observability/types';
import { getRunForOwner } from '@/lib/assistants/runs';
import type { ProfileParams } from '@/lib/assistants/types';
import { detectAssistantToolCTA } from '@/components/chat/AssistantToolCTA';

export const runtime = 'nodejs';

const Body = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().min(1),
        }),
      )
      .min(1),
    sessionId: z.string().uuid().optional(),
    // Sub-projeto 34 — Perfil da Categoria ativo no chat.
    // null/undefined = sem categoria (comportamento default).
    perfilId: z.string().uuid().nullable().optional(),
  })
  .refine(
    (b) => b.messages.length > 0 && b.messages[b.messages.length - 1]!.role === 'user',
    { message: 'last message must be from user' },
  );

function profileParamsToSnapshot(
  id: string,
  p: ProfileParams,
): ProfileSnapshot {
  return {
    id,
    nomeCategoria: p.nomeCategoria,
    descricao: p.descricao,
    subSegmentos: p.subSegmentos,
    escopoIncluido: p.escopoIncluido,
    escopoNaoIncluido: p.escopoNaoIncluido ?? '',
    requisitosTecnicos: p.requisitosTecnicos,
    restricoesRegulatorias: p.restricoesRegulatorias ?? '',
    prioridadeEstrategica: p.prioridadeEstrategica,
  };
}

export async function POST(req: Request): Promise<Response> {
  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const messages: ChatMessage[] = parsed.messages;
  const env = process.env.APP_ENV ?? 'production';

  // Resolve the active Perfil snapshot BEFORE opening the trace so we can
  // log perfilName in the trace input. Silent fallback: invalid/foreign/
  // non-done perfilId → snapshot stays null and chat runs default.
  let profileSnapshot: ProfileSnapshot | null = null;
  if (parsed.perfilId) {
    const run = await getRunForOwner(parsed.perfilId, user.id);
    if (
      run &&
      run.assistant_type === 'profile' &&
      run.status === 'done' &&
      run.params
    ) {
      profileSnapshot = profileParamsToSnapshot(
        run.id,
        run.params as ProfileParams,
      );
    } else {
      console.warn(
        `[api/chat] perfilId ${parsed.perfilId} invalid/foreign/not-done — falling back to default`,
      );
    }
  }

  // withUser propaga user.id via AsyncLocalStorage pra todo `recordApiUsage`
  // chamado em cascata (voyage embed, classifier, condenser, followups,
  // chat-generate) sem precisar passar userId em cada call site.
  return withUser(user.id, async () => {
  const trace = await startTrace({
    name: 'chat.turn',
    userId: user.id,
    sessionId: parsed.sessionId,
    input: {
      messages,
      perfilName: profileSnapshot
        ? profileSnapshot.nomeCategoria.slice(0, 80)
        : null,
    },
    tags: [`env:${env}`],
  });

  try {
    const condenseSpan = trace.span('condense', { messages });
    const standalone = await condenseQuery(messages);
    condenseSpan.end({ standalone });

    const rag = await runRag(standalone, {
      parentTrace: trace,
      profileContext: profileSnapshot,
    });

    const history = messages.slice(0, -1);
    const llmMessages: ChatMessage[] = [
      ...history,
      { role: 'user', content: rag.user },
    ];

    const openai = createOpenAI({
      apiKey: requireEnv('OPENAI_API_KEY'),
    });

    const data = new StreamData();
    data.appendMessageAnnotation({
      sources: rag.sources,
      classification: rag.classification,
      debug: rag.debug,
      traceId: trace.id,
    });

    // When the user's question is a supplier search, attach a CTA
    // annotation. Frontend renders an inline card after the assistant's
    // one-line ack that opens /assistants/suppliers pre-filled with the
    // original user query. Chat itself stays grounded in articles only —
    // CNPJ data lives in the dedicated assistant.
    if (rag.classification.intent === 'supplier_search') {
      const lastUserContent =
        messages[messages.length - 1]?.content ?? standalone;
      data.appendMessageAnnotation({
        supplierSearch: { query: lastUserContent.slice(0, 500) },
      });
    }

    const generateSpan = trace.span('generate', { systemLen: rag.system.length });

    const result = streamText({
      model: openai(getOpenAIModel('generation')),
      system: rag.system,
      messages: llmMessages,
      onFinish: async ({ text, usage, finishReason, providerMetadata }) => {
        // OpenAI's automatic prompt caching exposes `cached_tokens` via
        // providerMetadata (the AI SDK pulls it from
        // `usage.prompt_tokens_details.cached_tokens`). Log it on the span so
        // we can see hit rate per turn in Langfuse, and tag the trace for
        // easy filtering. Cached tokens cost 50% less, so this is the
        // signal we use to gauge whether prompt restructuring paid off.
        const cachedPromptTokens = (() => {
          const v = providerMetadata?.openai?.cachedPromptTokens;
          return typeof v === 'number' ? v : 0;
        })();
        const cachedPct =
          usage.promptTokens > 0
            ? Math.round((cachedPromptTokens / usage.promptTokens) * 100)
            : 0;

        generateSpan.end({
          tokens_in: usage.promptTokens,
          tokens_out: usage.completionTokens,
          tokens_cached: cachedPromptTokens,
          cached_pct: cachedPct,
          finish_reason: finishReason,
          chars_out: text.length,
        });
        trace.setTag(cachedPromptTokens > 0 ? 'cache:hit' : 'cache:miss');
        void recordApiUsage({
          provider: 'openai',
          operation: 'chat-generate',
          model: getOpenAIModel('generation'),
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          tokensCached: cachedPromptTokens,
          metadata: {
            intent: rag.classification.intent,
            finish_reason: finishReason,
            env,
          },
        });
        const aborted = finishReason === 'error';
        const level: TraceLevel = aborted ? 'WARNING' : 'DEFAULT';
        if (aborted) trace.setTag('aborted');

        // Sub-projeto 34 — persist the resolved perfilId on the session
        // row so reloads remember the active category. We persist EVEN
        // when the user explicitly clears it (perfilId === null) — that's
        // a deliberate "no category" choice. We skip persistence when the
        // user didn't send the field at all (undefined), avoiding stomping
        // an existing selection from a client that's not yet updated.
        if (parsed.sessionId && parsed.perfilId !== undefined) {
          const valueToWrite = profileSnapshot ? profileSnapshot.id : null;
          void getServerSupabase()
            .from('sessions')
            .update({ active_perfil_id: valueToWrite })
            .eq('id', parsed.sessionId)
            .then(({ error }) => {
              if (error) {
                console.warn(
                  '[api/chat] active_perfil_id update failed:',
                  error.message,
                );
              }
            });
        }

        // Detectar referência a uma ferramenta dedicada na resposta do LLM
        // e anexar annotation pra UI renderizar um CTA card grande no
        // lugar do link "aqui" pequeno (feedback beta 2026-05-22: link
        // markdown era pequeno demais no mobile + LLM hallucinava URL).
        if (!aborted && finishReason === 'stop' && text.length >= 20) {
          const ctaType = detectAssistantToolCTA(text);
          if (ctaType) {
            data.appendMessageAnnotation({ assistantCTA: ctaType });
          }
        }

        const shouldSuggest = !aborted && finishReason === 'stop' && text.length >= 20;
        if (shouldSuggest) {
          const followups = await suggestFollowups({
            query: standalone,
            answer: text,
            chunks: rag.chunks,
            classification: rag.classification,
            parentTrace: trace,
          });
          data.appendMessageAnnotation({ followups });
          if (followups.length === 0) trace.setTag('followups:empty');
        }

        // Title summary — only on the FIRST exchange of a session (the
        // history before this user message was empty, so this is the
        // first user→assistant pair). Replaces the auto-derived
        // "first-message-truncated" title with a real summary.
        const isFirstExchange =
          !aborted &&
          finishReason === 'stop' &&
          text.length >= 20 &&
          history.length === 0 &&
          !!parsed.sessionId;
        if (isFirstExchange) {
          const titleSpan = trace.span('summarize-title', {
            userLen: messages[messages.length - 1]!.content.length,
            answerLen: text.length,
          });
          const summary = await summarizeChatTitle({
            userMessage: messages[messages.length - 1]!.content,
            assistantSnippet: text,
          });
          if (summary) {
            data.appendMessageAnnotation({ sessionTitle: summary });
            // Persist to DB via service-role (RLS is owner-only; service-role
            // bypasses it, but we still scope by id which we trust because
            // the user is authenticated and the sessionId came from their
            // own browser).
            void getServerSupabase()
              .from('sessions')
              .update({ title: summary })
              .eq('id', parsed.sessionId!)
              .then(({ error }) => {
                if (error) {
                  console.warn('[api/chat] title update failed:', error.message);
                }
              });
          }
          titleSpan.end({ title: summary });
        }

        trace.end(
          { answer: text, sources: rag.sources, finishReason },
          level,
        );
        await flushAsync();
        data.close();
      },
    });

    return result.toDataStreamResponse({ data });
  } catch (err) {
    console.error('[api/chat] failed:', err);
    const message = err instanceof Error ? err.message : String(err);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'chat failed' }, { status: 500 });
  }
  });
}
