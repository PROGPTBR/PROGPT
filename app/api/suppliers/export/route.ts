import { NextResponse } from 'next/server';
import { NotAuthenticated, requireUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { searchSuppliers } from '@/lib/suppliers/search';
import { suppliersToCsv } from '@/lib/suppliers/csv-export';
import { EXPORT_CAP, SearchRequestSchema } from '@/lib/suppliers/types';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { withUser } from '@/lib/observability/user-context';

export const runtime = 'nodejs';

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

  return withUser(user.id, () => exportBody(req));
}

async function exportBody(req: Request): Promise<Response> {
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
    // Export ignora paginação do request — busca até EXPORT_CAP empresas
    // distintas e achata em linhas (1 por unidade/filial).
    const result = await searchSuppliers({
      ...parsed.data,
      limit: EXPORT_CAP,
      offset: 0,
    });
    const flatUnits = result.groups.flatMap((g) => g.units);
    const csv = suppliersToCsv(flatUnits);
    void recordApiUsage({
      provider: 'openai',
      operation: 'suppliers-export',
      metadata: {
        cnae: parsed.data.cnae,
        ufs_count: parsed.data.ufs?.length ?? 0,
        rows: flatUnits.length,
        groups: result.groups.length,
      },
    });

    const filename = buildFilename(parsed.data.cnae, parsed.data.ufs);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/suppliers/export] failed:', msg);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

function buildFilename(cnae: string, ufs: string[] | undefined): string {
  const date = new Date().toISOString().slice(0, 10);
  const ufPart = ufs && ufs.length > 0 ? `_${ufs.join('-')}` : '';
  return `fornecedores_${cnae}${ufPart}_${date}.csv`;
}
