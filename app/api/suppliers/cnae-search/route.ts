import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { searchCnaesByText } from '@/lib/suppliers/cnae-lookup';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';

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
  const url = new URL(req.url);
  const query = (url.searchParams.get('q') ?? '').trim();
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
