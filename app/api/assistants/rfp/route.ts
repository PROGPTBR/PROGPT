import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { RfpRequestSchema } from '@/lib/assistants/types';
import { getTemplate } from '@/lib/assistants/templates';
import { buildRfpPrompt } from '@/lib/assistants/rfp';
import { createRun, updateRunOutput, failRun } from '@/lib/assistants/runs';

export const runtime = 'nodejs';

const RERANK_TOP_N = 8;

// POST /api/assistants/rfp
// Body: { templateId: UUID, params: RfpParams }
// Streams the generated RFP markdown via SSE (Vercel AI SDK data stream).
// Persists output_md in onFinish so a future /docx download can re-render
// from the same source-of-truth.
export async function POST(req: Request): Promise<Response> {
  let parsed;
  try {
    const json = await req.json();
    parsed = RfpRequestSchema.parse(json);
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

  // Reuse the chat rate limit bucket. RFP generation is heavier than a chat
  // turn (~3000 output tokens vs ~500), so naturally fewer fit in the same
  // budget — that's the desired throttle without needing a separate limit.
  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return Response.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.rfp',
    userId: user.id,
    input: { templateId: parsed.templateId, params: parsed.params },
    tags: [`env:${env}`, 'assistant_type:rfp'],
  });

  // Lifecycle: load template → create run row → retrieve+rerank → prompt → stream → onFinish updates row.
  const loadSpan = trace.span('load-template', { templateId: parsed.templateId });
  const template = await getTemplate(parsed.templateId);
  if (!template) {
    loadSpan.end({ found: false }, 'WARNING');
    trace.end({ error: 'template_not_found' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'template_not_found' }, { status: 400 });
  }
  loadSpan.end({ found: true, bodyLen: template.body_md.length });

  const run = await createRun({
    userId: user.id,
    assistantType: 'rfp',
    templateId: template.id,
    params: parsed.params,
    traceId: trace.id,
  });
  if (!run) {
    trace.end({ error: 'run_insert_failed' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'run_insert_failed' }, { status: 500 });
  }

  // Retrieval grounded on category + scope (most semantic signal). We skip
  // the classifier — intent is rfp_draft by construction.
  const retrievalQuery = `${parsed.params.category} ${parsed.params.scope}`;
  const retrieveSpan = trace.span('retrieve', { query: retrievalQuery });
  const candidates = await retrieve(retrievalQuery);
  retrieveSpan.end({ count: candidates.length });

  const rerankSpan = trace.span('rerank', { candidates: candidates.length });
  const chunks = await rerank(retrievalQuery, candidates, RERANK_TOP_N);
  rerankSpan.end({ kept: chunks.length, top1Score: chunks[0]?.rerankScore ?? null });

  const { system, user: userPrompt } = buildRfpPrompt(parsed.params, template, chunks);

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const data = new StreamData();
  // We expose runId via a custom response header (X-Run-Id). Earlier
  // attempts used data.appendMessageAnnotation() but the Vercel AI SDK
  // serializes annotations with type code "8:" while our client was
  // looking for "2:" — silent mismatch left runId null and the download
  // button permanently disabled. The header is observable before the
  // stream is consumed, simpler, and immune to SDK protocol drift.
  data.appendMessageAnnotation({
    traceId: trace.id,
    templateName: template.name,
    chunkCount: chunks.length,
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
          operation: 'assistant-rfp-generate',
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
          await updateRunOutput(run.id, text);
          trace.end({ chars_out: text.length, runId: run.id });
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
    console.error('[api/assistants/rfp] failed:', err);
    await failRun(run.id, message);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'rfp_failed' }, { status: 500 });
  }
}
