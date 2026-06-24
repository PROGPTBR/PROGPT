import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { suggestCatmatItems } from '@/lib/govdata/precos';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';

// GET /api/assistants/pesquisa_precos/catalog-search?q=<descrição>
// Autocomplete do catálogo CATMAT pro form da Pesquisa de Preços. Navega
// Classe → PDM via LLM e devolve os itens reais do PDM (rankeados) pro usuário
// escolher — travando o codigoItem e eliminando o mismatch da resolução cega.
// Fail-soft: govdata off / nada encaixa → { itens: [] } (o submit ainda
// auto-resolve). Mesmo shape de auth/rate-limit do /api/suppliers/cnae-search.

const MAX_QUERY_LEN = 300; // = max da descrição do item no schema

export async function GET(req: Request): Promise<Response> {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  return withUser(user.id, () => catalogSearchBody(req));
}

async function catalogSearchBody(req: Request): Promise<Response> {
  const limit = await checkChatRateLimit();
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: limit.retryAfterSecs },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN);
  if (query.length < 3) {
    return NextResponse.json({ result: null, itens: [] });
  }

  try {
    const result = await suggestCatmatItems(query, { limit: 15 });
    void recordApiUsage({
      provider: 'openai',
      operation: 'govdata-catmat-suggest',
      metadata: { query_length: query.length, count: result?.itens.length ?? 0 },
    });
    return NextResponse.json({ result, itens: result?.itens ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/assistants/pesquisa_precos/catalog-search] failed:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
