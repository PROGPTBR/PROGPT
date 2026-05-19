import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { FinancialRequestSchema } from '@/lib/assistants/types';
import { getTemplate } from '@/lib/assistants/templates';
import {
  buildFinancialPrompt,
  calculateFinancialScore,
} from '@/lib/assistants/financial';
import { createRun, updateRunOutput, failRun } from '@/lib/assistants/runs';
import {
  splitTemplateBody,
  assembleOutput,
} from '@/lib/assistants/template-assembly';
import { getUserCompany } from '@/lib/db/user-company';

export const runtime = 'nodejs';

const RERANK_TOP_N = 6;

// POST /api/assistants/financial — generate a supplier financial health
// report. Mirrors the structure of /api/assistants/porter:
//   load template → create run → calculateFinancialScore (deterministic)
//   → retrieve+rerank → buildFinancialPrompt → streamText → onFinish
//   updates row.
export async function POST(req: Request): Promise<Response> {
  let parsed;
  try {
    const json = await req.json();
    parsed = FinancialRequestSchema.parse(json);
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
    name: 'assistant.financial',
    userId: user.id,
    input: { templateId: parsed.templateId, params: parsed.params },
    tags: [`env:${env}`, 'assistant_type:financial'],
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
    assistantType: 'financial',
    templateId: template.id,
    params: parsed.params,
    traceId: trace.id,
  });
  if (!run) {
    trace.end({ error: 'run_insert_failed' }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'run_insert_failed' }, { status: 500 });
  }

  // Deterministic scoring before LLM call — the system owns the
  // score/rating/recommendation; the LLM only narrates the story.
  const scoreSpan = trace.span('calculate-score', {});
  const analysis = calculateFinancialScore(parsed.params.indicators);
  scoreSpan.end({
    score: analysis.score,
    rating: analysis.rating,
    recommendation: analysis.recommendation,
    incomplete: analysis.incomplete,
    missingPillars: analysis.missingPillars,
  });

  // Retrieval bias toward credit analysis / supplier risk material in
  // the corpus (if any was ingested). Even with thin coverage, the
  // deterministic score + system prompt produce a coherent report.
  const retrievalQuery = `análise financeira de fornecedor ${parsed.params.supplierName} risco de crédito EBITDA liquidez`;
  const retrieveSpan = trace.span('retrieve', { query: retrievalQuery });
  const candidates = await retrieve(retrievalQuery);
  retrieveSpan.end({ count: candidates.length });

  const rerankSpan = trace.span('rerank', { candidates: candidates.length });
  const chunks = await rerank(retrievalQuery, candidates, RERANK_TOP_N);
  rerankSpan.end({ kept: chunks.length, top1Score: chunks[0]?.rerankScore ?? null });

  const company = await getUserCompany(user.id);

  const { system, user: userPrompt } = buildFinancialPrompt(
    parsed.params,
    template,
    chunks,
    analysis,
    company,
  );

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const data = new StreamData();
  data.appendMessageAnnotation({
    traceId: trace.id,
    templateName: template.name,
    chunkCount: chunks.length,
    financialScore: analysis.score,
    financialRating: analysis.rating,
    financialRecommendation: analysis.recommendation,
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
          operation: 'assistant-financial-generate',
          model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
          tokensIn: usage.promptTokens,
          tokensOut: usage.completionTokens,
          tokensCached: cachedPromptTokens,
          metadata: {
            runId: run.id,
            finish_reason: finishReason,
            template_id: template.id,
            env,
            score: analysis.score,
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
    console.error('[api/assistants/financial] failed:', err);
    await failRun(run.id, message);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return Response.json({ error: 'financial_failed' }, { status: 500 });
  }
}
