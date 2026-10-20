import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { withUser } from '@/lib/observability/user-context';
import { extrairPropostasTributarias } from '@/lib/tributario/extrair';
import { moduloBloqueado } from '@/lib/modulos/servidor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ texto: z.string().trim().min(20).max(400_000) });

// POST /api/assistants/tributario_propostas/extrair { texto }
// Lê as propostas e devolve os dados fiscais de cada fornecedor para o
// comprador conferir antes do cálculo.
export async function POST(req: Request) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body', detail: 'Cole ou importe as propostas antes de extrair.' }, { status: 400 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (await moduloBloqueado(user.id, 'tributario_propostas')) {
    return NextResponse.json({ error: 'module_disabled' }, { status: 403 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSecs) } },
    );
  }

  return withUser(user.id, async () => {
    try {
      const propostas = await extrairPropostasTributarias(body.texto);
      return NextResponse.json({ propostas });
    } catch (err) {
      console.error('[api/assistants/tributario_propostas/extrair] failed:', err);
      return NextResponse.json(
        { error: 'extract_failed', detail: 'Não consegui ler as propostas. Confira o texto ou preencha os dados à mão.' },
        { status: 500 },
      );
    }
  });
}
