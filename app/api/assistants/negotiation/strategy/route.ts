import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { createRun, updateRunStrategy, failRun } from '@/lib/assistants/runs';
import { NegotiationStrategyRequestSchema } from '@/lib/assistants/types';
import { generateStrategy } from '@/lib/assistants/negotiation/prompt-strategy';
import { strategyToMarkdown } from '@/lib/assistants/negotiation/strategy-md';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 90; // estratégia leva 30-60s no gpt-4o-mini

export async function POST(req: Request): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  return withUser(user.id, () => strategyBody(req, user));
}

async function strategyBody(req: Request, user: { id: string }): Promise<Response> {
  // Acesso liberado a todo usuário logado (decisão 2026-07-07: cartão no
  // cadastro ⇒ sem bloqueio de pagamento in-app). Gate antigo (canUseAssistant
  // → 402 paywall) removido — ver git. Rate-limit abaixo é o backstop.

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = NegotiationStrategyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'assistant.negotiation.strategy',
    userId: user.id,
    input: {
      supplierName: parsed.data.params.supplierName,
      category: parsed.data.params.category,
    },
    tags: [`env:${env}`, 'assistant:negotiation', 'phase:strategy'],
  });

  // Criar run primeiro (status='running') pra ter ID que retornamos
  // mesmo se a generation falhar — usuário pode re-tentar via o mesmo run.
  const run = await createRun({
    userId: user.id,
    assistantType: 'negotiation',
    templateId: null,
    params: parsed.data.params,
    traceId: trace.id,
  });
  if (!run) {
    trace.end({ error: 'createRun failed' }, 'ERROR');
    await flushAsync();
    return NextResponse.json({ error: 'create_run_failed' }, { status: 500 });
  }

  const generateSpan = trace.span('generate-strategy', {});
  try {
    const strategy = await generateStrategy(parsed.data.params);
    const outputMd = strategyToMarkdown(parsed.data.params, strategy);
    await updateRunStrategy(run.id, strategy, outputMd);
    generateSpan.end({ outputChars: outputMd.length });
    trace.end({ ok: true });
    await flushAsync();
    return NextResponse.json({ runId: run.id, strategy });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/negotiation/strategy] failed:', msg);
    void failRun(run.id, msg);
    generateSpan.end({ error: msg.slice(0, 200) }, 'ERROR');
    trace.end({ error: msg.slice(0, 200) }, 'ERROR');
    await flushAsync();
    return NextResponse.json(
      { error: 'strategy_failed', message: msg.slice(0, 200), runId: run.id },
      { status: 500 },
    );
  }
}
