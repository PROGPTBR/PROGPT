import { streamText, StreamData } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';
import type { ApiOperation } from '@/lib/observability/api-usage';
import { getTemplate } from '@/lib/assistants/templates';
import {
  createRun,
  updateRunOutput,
  failRun,
} from '@/lib/assistants/runs';
import {
  splitTemplateBody,
  assembleOutput,
  type AssistantParams,
} from '@/lib/assistants/template-assembly';
import { getUserCompany } from '@/lib/db/user-company';
import type { CompanyData } from '@/lib/db/user-company';
import type { RetrievedChunk } from '@/lib/rag/types';
import type { AssistantType, TemplateRow } from '@/lib/assistants/types';

// Sub-projeto 32 — Generic handler for the /api/assistants/* routes.
//
// Five assistants (RFP, Kraljic, Porter, Financial, ABC) share ~85% of
// their POST handler boilerplate: parse body → auth → rate-limit → open
// Langfuse trace → load template → create run → retrieve+rerank → build
// prompt → stream → onFinish (recordApiUsage + assemble + persist) →
// catch. The only real per-assistant variation is the prompt construction
// and the deterministic pre-step (Kraljic classifyItems, ABC classifyAbc,
// etc.). This module extracts the boilerplate into one function and lets
// each route declare just the variation surface.

export type AssistantHandlerConfig<
  Schema extends z.ZodTypeAny,
  Classified,
> = {
  type: AssistantType;
  // Zod schema for the request body. Must yield { templateId, params } —
  // matches the *RequestSchema export each assistant already has.
  requestSchema: Schema;
  // Optional Langfuse trace input shape; defaults to the parsed body.
  traceInput?: (parsed: z.infer<Schema>) => Record<string, unknown>;
  // Optional deterministic pre-step (Kraljic/Porter/Financial/ABC).
  // Runs after the run row is created and before retrieval. Returns the
  // classified object that is then passed to buildPrompt + the optional
  // logging of the classify span.
  classify?: {
    spanName?: string;
    spanInput?: (
      params: z.infer<Schema>['params'],
    ) => Record<string, unknown>;
    spanOutput?: (classified: Classified) => Record<string, unknown>;
    run: (params: z.infer<Schema>['params']) => Classified;
  };
  // Build the retrieval query from params + the classification result.
  buildRetrievalQuery: (
    params: z.infer<Schema>['params'],
    classified: Classified,
  ) => string;
  rerankTopN: number;
  // Build the system+user prompts. Receives params, template, retrieved
  // chunks, the classification (if classify was provided, else undefined),
  // and the company data.
  buildPrompt: (args: {
    params: z.infer<Schema>['params'];
    template: TemplateRow;
    chunks: RetrievedChunk[];
    classified: Classified;
    company: CompanyData | null;
  }) => { system: string; user: string };
  // recordApiUsage operation label.
  generateOp: ApiOperation;
  // Optional extra fields merged into recordApiUsage.metadata at the end.
  // Useful for assistant-specific telemetry (e.g. item count for ABC).
  generateMetadata?: (args: {
    params: z.infer<Schema>['params'];
    classified: Classified;
    template: TemplateRow;
  }) => Record<string, unknown>;
  // Optional extra fields merged into the SSE annotation. The base shape
  // (traceId, templateName, chunkCount) is always emitted.
  annotation?: (args: {
    chunks: RetrievedChunk[];
    classified: Classified;
  }) => Record<string, unknown>;
  // Optional override for the params shape passed to assembleOutput.
  // Kraljic synthesizes an RfpParams-shaped facade because its tail is
  // mostly generic legal text expecting `client`/`scope` placeholders.
  // Default: pass `params` straight through.
  paramsForAssembly?: (
    params: z.infer<Schema>['params'],
    company: CompanyData | null,
  ) => AssistantParams;
};

export function buildAssistantHandler<
  Schema extends z.ZodTypeAny,
  Classified = undefined,
>(config: AssistantHandlerConfig<Schema, Classified>) {
  const errorTag = `${config.type}_failed`;

  return async function POST(req: Request): Promise<Response> {
    let parsed: z.infer<Schema>;
    try {
      const json = await req.json();
      parsed = config.requestSchema.parse(json);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : 'invalid body' },
        { status: 400 },
      );
    }

    const user = await getCurrentUser();
    if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

    // Paywall: sub-projeto 27. Free tier = 1 execução lifetime por assistant_type.
    const { canUseAssistant } = await import('@/lib/billing/quota');
    if (!(await canUseAssistant(user.id, config.type))) {
      return Response.json(
        { error: 'paywall', plan: 'free', assistant_type: config.type },
        { status: 402 },
      );
    }

    const rl = await checkChatRateLimit();
    if (!rl.allowed) {
      return Response.json(
        { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
      );
    }

    // withUser propaga user.id pra todo recordApiUsage feito downstream
    // (retrieve→voyage embed, rerank→cohere, streamText→chat-generate).
    return withUser(user.id, async () => {

    const env = process.env.APP_ENV ?? 'production';
    const trace = await startTrace({
      name: `assistant.${config.type}`,
      userId: user.id,
      input:
        config.traceInput?.(parsed) ?? {
          templateId: parsed.templateId,
          params: parsed.params,
        },
      tags: [`env:${env}`, `assistant_type:${config.type}`],
    });

    const loadSpan = trace.span('load-template', {
      templateId: parsed.templateId,
    });
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
      assistantType: config.type,
      templateId: template.id,
      params: parsed.params,
      traceId: trace.id,
    });
    if (!run) {
      trace.end({ error: 'run_insert_failed' }, 'ERROR');
      await flushAsync();
      return Response.json({ error: 'run_insert_failed' }, { status: 500 });
    }

    // Deterministic pre-step (optional). The result feeds both the prompt
    // and the retrieval query.
    let classified: Classified;
    if (config.classify) {
      const classifySpan = trace.span(
        config.classify.spanName ?? 'classify',
        config.classify.spanInput?.(parsed.params) ?? {},
      );
      classified = config.classify.run(parsed.params);
      classifySpan.end(config.classify.spanOutput?.(classified) ?? {});
    } else {
      classified = undefined as Classified;
    }

    const retrievalQuery = config.buildRetrievalQuery(parsed.params, classified);
    const retrieveSpan = trace.span('retrieve', { query: retrievalQuery });
    const candidates = await retrieve(retrievalQuery);
    retrieveSpan.end({ count: candidates.length });

    const rerankSpan = trace.span('rerank', { candidates: candidates.length });
    const chunks = await rerank(retrievalQuery, candidates, config.rerankTopN);
    rerankSpan.end({
      kept: chunks.length,
      top1Score: chunks[0]?.rerankScore ?? null,
    });

    const company = await getUserCompany(user.id);
    const { system, user: userPrompt } = config.buildPrompt({
      params: parsed.params,
      template,
      chunks,
      classified,
      company,
    });

    const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
    const data = new StreamData();
    data.appendMessageAnnotation({
      traceId: trace.id,
      templateName: template.name,
      chunkCount: chunks.length,
      ...(config.annotation?.({ chunks, classified }) ?? {}),
    });

    const generateSpan = trace.span('generate', { systemLen: system.length });

    try {
      const result = streamText({
        model: openai(getOpenAIModel('generation')),
        // Default 1.0 é alto demais e deixa o entregável inconsistente entre
        // execuções. 0.4 mantém alguma variação narrativa com consistência.
        temperature: 0.4,
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
            operation: config.generateOp,
            model: getOpenAIModel('generation'),
            tokensIn: usage.promptTokens,
            tokensOut: usage.completionTokens,
            tokensCached: cachedPromptTokens,
            metadata: {
              runId: run.id,
              finish_reason: finishReason,
              template_id: template.id,
              env,
              ...(config.generateMetadata?.({
                params: parsed.params,
                classified,
                template,
              }) ?? {}),
            },
          });

          if (finishReason === 'stop' && text.length > 0) {
            const { tail } = splitTemplateBody(template.body_md);
            const assemblyParams = config.paramsForAssembly
              ? config.paramsForAssembly(parsed.params, company)
              : (parsed.params as AssistantParams);
            const assembled = assembleOutput(text, tail, assemblyParams, company);
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
      console.error(`[api/assistants/${config.type}] failed:`, err);
      await failRun(run.id, message);
      trace.end({ error: message }, 'ERROR');
      await flushAsync();
      return Response.json({ error: errorTag }, { status: 500 });
    }
    });
  };
}
