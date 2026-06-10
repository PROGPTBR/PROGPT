import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { retrieve } from '@/lib/rag/retriever';
import { rerank } from '@/lib/rag/reranker';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { startTrace, flushAsync } from '@/lib/observability/langfuse';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';
export const maxDuration = 30;

// POST /api/chat/voice/retrieve — sub-projeto 35.
//
// Executor da tool `buscar_base_conhecimento` da sessão de voz realtime: o
// modelo formula a query, o browser chama aqui, devolvemos os trechos como
// function_call_output. Pula classifier/condenser (o modelo realtime já
// reformulou a pergunta como consulta autônoma); 8 trechos bastam pra uma
// resposta FALADA curta. embed/rerank se auto-registram no /admin/costs
// (wrappers voyage/cohere).

const Body = z.object({ query: z.string().trim().min(3).max(500) });

const VOICE_TOP_N = 8;
const CONTEXT_CHAR_CAP = 12_000;

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return withUser(user.id, () => retrieveBody(req, user));
}

async function retrieveBody(req: Request, user: { id: string }): Promise<Response> {
  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const env = process.env.APP_ENV ?? 'production';
  const trace = await startTrace({
    name: 'chat.voice.retrieve',
    userId: user.id,
    input: { query: body.query },
    tags: [`env:${env}`, 'voice'],
  });

  try {
    const span = trace.span('retrieve-rerank', { query: body.query });
    const candidates = await retrieve(body.query);
    const chunks = await rerank(body.query, candidates, VOICE_TOP_N);
    span.end({ candidates: candidates.length, kept: chunks.length });

    let context = '';
    for (const c of chunks) {
      const piece = `### ${c.articleTitle}\n\n${c.content}\n\n`;
      if (context.length + piece.length > CONTEXT_CHAR_CAP) break;
      context += piece;
    }

    trace.end({ ok: true, kept: chunks.length });
    await flushAsync();
    return NextResponse.json({ context: context.trim() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[chat/voice/retrieve] failed:', msg);
    trace.end({ ok: false });
    await flushAsync();
    // Fail-soft: a sessão de voz segue sem fundamento (o prompt manda
    // sinalizar falta de fonte) em vez de derrubar a conversa.
    return NextResponse.json({ context: '' });
  }
}
