import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { PorterRequestSchema } from '@/lib/assistants/types';
import { getTemplate } from '@/lib/assistants/templates';
import { buildPorterPrompt, classifyPorterForces } from '@/lib/assistants/porter';
import { createRun, updateRunOutput, failRun } from '@/lib/assistants/runs';
import { splitTemplateBody, assembleOutput } from '@/lib/assistants/template-assembly';
import { getUserCompany } from '@/lib/db/user-company';

export const runtime = 'nodejs';

const RERANK_TOP_N = 8;

// POST /api/assistants/porter
// Body: { templateId: UUID, params: PorterParams }
// Streams the generated 5 Forces of Porter analysis via SSE (Vercel AI
// SDK data stream). Persists output_md in onFinish so a future /docx
// download can re-render from the same source-of-truth.
//
// Mirrors the structure of /api/assistants/rfp and /api/assistants/kraljic
// — same lifecycle (load template → create run → retrieve+rerank →
// prompt → stream → onFinish updates row), same trace span layout, same
// rate-limit bucket as /api/chat.
export async function POST(req: Request): Promise<Response> {
  let parsed;
  try {
    const json = await req.json();
    parsed = PorterRequestSchema.parse(json);
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

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.porter',
    userId: user.id,
    input: { templateId: parsed.templateId, params: parsed.params },
    tags: [`env:${env}`, 'assistant_type:porter'],
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

  const run = await createRun({
    userId: user.id,
    assistantType: 'porter',
    templateId: template.id,
    params: parsed.params,
    traceId: trace.id,
  });
  if (!run) {
    trace.end({ error: 'run_insert_failed' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'run_insert_failed' }, { status: 500 });
  }

  // Retrieval anchored on category + 'porter forças competitivas' so we
  // bias toward the canonical Porter material in the corpus (HBR 1979,
  // Competitive Strategy 1980, Competitive Advantage 1985).
  const retrievalQuery = `${parsed.params.categoria} ${parsed.params.segmento ?? ''} 5 forças de Porter rivalidade fornecedores compradores`;
  const retrieveSpan = trace.span('retrieve', { query: retrievalQuery });
  const candidates = await retrieve(retrievalQuery);
  retrieveSpan.end({ count: candidates.length });

  const rerankSpan = trace.span('rerank', { candidates: candidates.length });
  const chunks = await rerank(retrievalQuery, candidates, RERANK_TOP_N);
  rerankSpan.end({ kept: chunks.length, top1Score: chunks[0]?.rerankScore ?? null });

  const company = await getUserCompany(user.id);

  // Deterministic step: classify the 35 statement scorings into per-force
  // weighted averages + intensities. This is what the LLM narrates.
  const classifySpan = trace.span('classify', {
    statementCount: parsed.params.statements.length,
  });
  const classification = classifyPorterForces(parsed.params.statements);
  classifySpan.end({
    overall: classification.overallAvg,
    overallIntensity: classification.overallIntensity,
    byForce: classification.byForce.map((f) => ({
      force: f.force,
      avg: f.weightedAvg,
      intensity: f.intensity,
    })),
  });

  const { system, user: userPrompt } = buildPorterPrompt(
    parsed.params,
    template,
    chunks,
    classification,
    company,
  );

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const data = new StreamData();
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
          operation: 'assistant-porter-generate',
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
          const assembled = assembleOutput(text, tail, parsed.params, company);
          await updateRunOutput(run.id, assembled);
          trace.end({
            chars_out: assembled.length,
            llm_chars: text.length,
            tail_appended: tail !== null,
            runId: run.id,
          });
        } else {
          await failRun(run.id, `finish_reason=${finishReason}`);
          trace.end(
            { error: `finish_reason=${finishReason}`, runId: run.id },
            'WARNING',
          );
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
    console.error('[api/assistants/porter] failed:', err);
    await failRun(run.id, message);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'porter_failed' }, { status: 500 });
  }
}
