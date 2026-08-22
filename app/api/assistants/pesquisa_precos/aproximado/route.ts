import { NextResponse } from 'next/server';
import { z } from 'zod';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { buscarPrecoAproximado } from '@/lib/assistants/precos-aproximado';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';

// POST /api/assistants/pesquisa_precos/aproximado — backlog do diretor
// (2026-08-19, Batch G). "Buscar preço e NCM aproximado": quando um item da
// Pesquisa de Preços fica sem amostra no CATMAT, o comprador pede uma
// estimativa via busca web (indicativo/não-oficial). Fail-soft: PRECOS_WEBSEARCH
// desligado ou erro → { enabled/available: false }, nunca 500 por conta disso.

const Body = z.object({
  descricao: z.string().trim().min(2).max(300),
  unidade: z.string().trim().max(40).optional(),
});

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

  return withUser(user.id, () => aproximadoBody(req));
}

async function aproximadoBody(req: Request): Promise<Response> {
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

  const result = await buscarPrecoAproximado(body);
  return NextResponse.json(result);
}
