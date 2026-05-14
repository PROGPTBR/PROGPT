import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { getRunForOwner, updateRunOutput } from '@/lib/assistants/runs';
import {
  splitAssembledOutput,
  ASSEMBLY_BOUNDARY,
} from '@/lib/assistants/template-assembly';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  suggestion: z.string().trim().min(5).max(8000),
});

const SYSTEM_PROMPT = `Você é um especialista sênior em procurement editando um draft de RFP. Receberá:

1. O draft ATUAL do RFP (apenas as seções customizáveis — Apresentação, Info do Projeto, Especificações, Critérios).
2. Uma SUGESTÃO de melhoria proposta pelo consultor (geralmente sua resposta anterior no chat).

Sua tarefa: produzir a versão atualizada do RFP incorporando a sugestão. Regras:

- Output: APENAS o markdown do RFP atualizado, sem preâmbulo, sem comentário, sem cercas de código.
- Preserve a estrutura (mesmos headings, mesma ordem das seções) salvo se a sugestão pedir reordenação explícita.
- Não invente seções novas além do que o draft atual já tem ou a sugestão pede.
- Mantenha o tom e estilo do draft original.
- Mantenha valores reais (nomes, CNPJ, e-mails) — não substitua por placeholders.
- Se a sugestão for ambígua ou inviável, faça a melhor interpretação razoável.`;

// POST /api/assistants/runs/[id]/apply — merges a refine-chat suggestion
// into the RFP's customizable head. Verbatim tail (Cotação + Termos +
// Código) is untouched.
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  let parsed;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  const { head, tail } = splitAssembledOutput(run.output_md);

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.rfp.apply',
    userId: user.id,
    input: { runId: run.id, suggestionLen: parsed.suggestion.length },
    tags: [`env:${env}`, 'assistant_type:rfp', 'phase:apply'],
  });

  const userPrompt = `## Draft atual do RFP

${head}

## Sugestão a incorporar

${parsed.suggestion}

## Sua resposta

Reescreva o RFP acima incorporando a sugestão. Apenas o markdown atualizado, nada mais.`;

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const generateSpan = trace.span('generate', { headLen: head.length });

  try {
    const result = await generateText({
      model: openai(process.env.OPENAI_MODEL ?? 'gpt-4o-mini'),
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const cachedPromptTokens = (() => {
      const v = result.providerMetadata?.openai?.cachedPromptTokens;
      return typeof v === 'number' ? v : 0;
    })();
    generateSpan.end({
      tokens_in: result.usage.promptTokens,
      tokens_out: result.usage.completionTokens,
      tokens_cached: cachedPromptTokens,
      chars_out: result.text.length,
    });
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-rfp-apply',
      model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
      tokensIn: result.usage.promptTokens,
      tokensOut: result.usage.completionTokens,
      tokensCached: cachedPromptTokens,
      metadata: { runId: run.id, env },
    });

    // Re-assemble with the verbatim tail intact. Always re-emit the
    // boundary marker so subsequent applies can split again.
    const newOutput = tail
      ? `${result.text.trimEnd()}\n\n${ASSEMBLY_BOUNDARY}\n\n${tail.trimStart()}`
      : result.text.trim();

    await updateRunOutput(run.id, newOutput);
    trace.end({ chars_out: newOutput.length, runId: run.id });
    await flushAsync();

    return NextResponse.json({ ok: true, output_md: newOutput });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/.../apply] failed:', err);
    trace.end({ error: message }, 'ERROR');
    await flushAsync();
    return NextResponse.json({ error: 'apply_failed' }, { status: 500 });
  }
}
