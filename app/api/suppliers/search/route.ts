import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { searchSuppliers } from '@/lib/suppliers/search';
import { SearchRequestSchema } from '@/lib/suppliers/types';
import { recordApiUsage } from '@/lib/observability/api-usage';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const limit = await checkChatRateLimit();
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: limit.retryAfterSecs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = SearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await searchSuppliers(parsed.data);
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-search',
      metadata: {
        cnae: parsed.data.cnae,
        ufs_count: parsed.data.ufs?.length ?? 0,
        group_count: result.groups.length,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/suppliers/search] failed:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
