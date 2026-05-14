import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { KraljicRequestSchema } from '@/lib/assistants/types';
import { getTemplate } from '@/lib/assistants/templates';
import { classifyItems, buildKraljicPrompt } from '@/lib/assistants/kraljic';
import { createRun, updateRunOutput, failRun } from '@/lib/assistants/runs';
import { splitTemplateBody, assembleOutput } from '@/lib/assistants/template-assembly';
import { getUserCompany } from '@/lib/db/user-company';

export const runtime = 'nodejs';

const RERANK_TOP_N = 6;

// POST /api/assistants/kraljic
// Body: { templateId: UUID, params: KraljicParams }
// Streams the LLM-generated executive narrative; classification +
// chart are deterministic and happen server-side.
export async function POST(req: Request): Promise<Response> {
  let parsed;
  try {
    parsed = KraljicRequestSchema.parse(await req.json());
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.kraljic',
    userId: user.id,
    input: {
      templateId: parsed.templateId,
      portfolioName: parsed.params.portfolioName,
      itemCount: parsed.params.items.length,
    },
    tags: [`env:${env}`, 'assistant_type:kraljic'],
  });

  const loadSpan = trace.span('load-template', { templateId: parsed.templateId });
  const template = await getTemplate(parsed.templateId);
  if (!template) {
    loadSpan.end({ found: false }, 'WARNING');
    trace.end({ error: 'template_not_found' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'template_not_found' }, { status: 400 });
  }
  loadSpan.end({ found: true, bodyLen: template.body_md.length });

  // Classify locally — zero LLM cost, zero risk of mis-classification.
  const classifySpan = trace.span('classify', { count: parsed.params.items.length });
  const classified = classifyItems(parsed.params.items);
  classifySpan.end({
    estrategico: classified.filter((c) => c.quadrant === 'estrategico').length,
    alavancavel: classified.filter((c) => c.quadrant === 'alavancavel').length,
    gargalo: classified.filter((c) => c.quadrant === 'gargalo').length,
    naoCritico: classified.filter((c) => c.quadrant === 'nao-critico').length,
  });

  const run = await createRun({
    userId: user.id,
    assistantType: 'kraljic',
    templateId: template.id,
    // params is typed as RfpParams in createRun for legacy reasons;
    // the column is JSONB so this is fine at runtime.
    params: parsed.params as never,
    traceId: trace.id,
  });
  if (!run) {
    trace.end({ error: 'run_insert_failed' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'run_insert_failed' }, { status: 500 });
  }

  // RAG query mixes the portfolio name + a Kraljic anchor + top 3 categories.
  const topCategories = Array.from(
    new Set(classified.map((c) => c.category).filter(Boolean)),
  ).slice(0, 3);
  const retrievalQuery = `Matriz de Kraljic ${parsed.params.portfolioName} ${topCategories.join(' ')}`;
  const retrieveSpan = trace.span('retrieve', { query: retrievalQuery });
  const candidates = await retrieve(retrievalQuery);
  retrieveSpan.end({ count: candidates.length });

  const rerankSpan = trace.span('rerank', { candidates: candidates.length });
  const chunks = await rerank(retrievalQuery, candidates, RERANK_TOP_N);
  rerankSpan.end({ kept: chunks.length, top1Score: chunks[0]?.rerankScore ?? null });

  const company = await getUserCompany(user.id);
  const { system, user: userPrompt } = buildKraljicPrompt(
    parsed.params,
    classified,
    template,
    chunks,
    company,
  );

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const data = new StreamData();
  data.appendMessageAnnotation({
    traceId: trace.id,
    templateName: template.name,
    chunkCount: chunks.length,
    itemCount: classified.length,
  });

  const generateSpan = trace.span('generate', { systemLen: system.length });

  try {
    const result = streamText({
      model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
      system,
      messages: [{ role: 'user', content: userPrompt }],
      onFinish: async ({ text, usage, finishReason, providerMetadata }) => {
        const cachedPromptTokens = (() => {
          const v = providerMetadata?.openai?.cachedPromptTokens;
          return typeof v === 'number' ? v : 0;
        })();
        generateSpan.end({
          tokens_in: usage.promptTokens,
          tokens_out: usage.completionTokens,
          tokens_cached: cachedPromptTokens,
          finish_reason: finishReason,
          chars_out: text.length,
        });
        void recordApiUsage({
          provider: 'openai',
          operation: 'assistant-kraljic-generate',
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          tokensCached: cachedPromptTokens,
          metadata: {
            runId: run.id,
            finish_reason: finishReason,
            template_id: template.id,
            env,
          },
        });

        if (finishReason === 'stop' && text.length > 0) {
          const { tail } = splitTemplateBody(template.body_md);
          // Reuse the renderPlaceholders pipeline by synthesizing an
          // RfpParams-shaped facade. Kraljic-specific placeholders
          // aren't expected in the template tail (it's mostly generic
          // closing legal text), but cliente/empresa_* are.
          const assembled = assembleOutput(
            text,
            tail,
            {
              client: company?.company_name ?? '',
              scope: parsed.params.portfolioName,
              category: 'Análise de portfólio (Kraljic)',
              deadline: '',
              budget: '',
              criteria: [],
              notes: parsed.params.notes ?? '',
            },
            company,
          );
          await updateRunOutput(run.id, assembled);
          trace.end({
            chars_out: assembled.length,
            llm_chars: text.length,
            tail_appended: tail !== null,
            runId: run.id,
          });
        } else {
          await failRun(run.id, `finish_reason=${finishReason}`);
          trace.end({ error: `finish_reason=${finishReason}`, runId: run.id }, 'WARNING');
        }
        await flushAsync();
        data.close();
      },
    });

    return result.toDataStreamResponse({
      data,
      headers: { 'X-Run-Id': run.id },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/kraljic] failed:', err);
    await failRun(run.id, message);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'kraljic_failed' }, { status: 500 });
  }
}
