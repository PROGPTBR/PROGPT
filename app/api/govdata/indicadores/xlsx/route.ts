import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { INDICADOR_META, isIndicadorKey, serieIndicador } from '@/lib/govdata/indicadores';
import { serieXlsxBuffer } from '@/lib/govdata/indicadores-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/govdata/indicadores/xlsx?key=selic&meses=24 — sub-projeto 37.
// Export .xlsx da série histórica do indicador. Auth + rate-limit.

function clampMeses(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 24;
  return Math.min(240, Math.max(1, Math.round(n)));
}

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  const url = new URL(req.url);
  const key = url.searchParams.get('key') ?? '';
  if (!isIndicadorKey(key)) {
    return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  }
  const meses = clampMeses(url.searchParams.get('meses'));
  const meta = INDICADOR_META[key];

  const pontos = await serieIndicador(key, meses);
  const buf = await serieXlsxBuffer(meta.nome, meta.unidade, pontos);

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${key}-${meses}m.xlsx"`,
      'Content-Length': String(buf.length),
    },
  });
}
