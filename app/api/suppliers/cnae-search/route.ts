import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { searchCnaesByText } from '@/lib/suppliers/cnae-lookup';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';

// Limite superior de tamanho da query — defesa contra payload absurdo
// (busca local, mas não há motivo pra processar > 100 chars).
const MAX_QUERY_LEN = 100;

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

  return withUser(user.id, () => cnaeSearchBody(req));
}

async function cnaeSearchBody(req: Request): Promise<Response> {
  const limit = await checkChatRateLimit();
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: limit.retryAfterSecs },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LEN);
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchCnaesByText(query, 10);
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-cnae-search',
      metadata: { query_length: query.length, count: results.length },
    });
    return NextResponse.json({ results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/suppliers/cnae-search] failed:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
