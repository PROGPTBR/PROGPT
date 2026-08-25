import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { parseQuickChartInput, QUICK_CHART_MAX_FILE_BYTES } from '@/lib/charts/quick-chart-parse';
import { inferQuickChartSpec } from '@/lib/charts/quick-chart-infer';
import { buildQuickChartSeries } from '@/lib/charts/quick-chart-series';
import { renderQuickChartPng } from '@/lib/charts/quick-chart-render';
import type { QuickChartKind } from '@/lib/charts/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_CHART_TYPES = new Set<QuickChartKind>(['bar', 'line', 'pie']);

// POST /api/tools/quick-chart — "Gráfico Rápido": recebe dado LIVRE (texto
// colado ou planilha CSV/XLSX), infere categoria/valor/tipo (LLM tier
// routing + fallback heurístico determinístico) e devolve um PNG pronto pra
// baixar. NÃO é um assistente (sem assistant_runs, sem migration, sem
// paywall) — é uma ferramenta utilitária, mesmo espírito de
// app/api/govdata/indicadores. Rate limit compartilha o bucket do /api/chat.
export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited', retry_after_secs: rl.retryAfterSecs },
      { status: 429 },
    );
  }

  let text: string | undefined;
  let file: File | null = null;
  let chartTypeOverride: QuickChartKind | undefined;
  let title: string | undefined;
  try {
    const form = await req.formData();
    const t = form.get('text');
    if (typeof t === 'string' && t.trim()) text = t;
    const f = form.get('file');
    if (f instanceof File) file = f;
    const ct = form.get('chartType');
    if (typeof ct === 'string' && VALID_CHART_TYPES.has(ct as QuickChartKind)) {
      chartTypeOverride = ct as QuickChartKind;
    }
    const ti = form.get('title');
    if (typeof ti === 'string' && ti.trim()) title = ti.trim().slice(0, 80);
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  if (!text && !file) {
    return NextResponse.json({ error: 'no_data' }, { status: 400 });
  }
  if (file && file.size > QUICK_CHART_MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  const { table, warnings: parseWarnings } = file
    ? await parseQuickChartInput({
        buf: Buffer.from(await file.arrayBuffer()),
        mime: file.type,
        filename: file.name,
      })
    : await parseQuickChartInput({ text });

  if (table.headers.length < 2) {
    return NextResponse.json({ error: 'need_two_columns', warnings: parseWarnings }, { status: 400 });
  }
  if (table.rows.length === 0) {
    return NextResponse.json({ error: 'no_rows', warnings: parseWarnings }, { status: 400 });
  }

  const spec = await inferQuickChartSpec(table, chartTypeOverride, title);
  const { series, warnings: seriesWarnings } = buildQuickChartSeries(table, spec);
  const warnings = [...parseWarnings, ...seriesWarnings];

  if (series.labels.length === 0) {
    return NextResponse.json({ error: 'no_series', warnings }, { status: 400 });
  }

  let png: Buffer;
  try {
    png = await renderQuickChartPng(series, spec);
  } catch (err) {
    console.warn('[quick-chart] render failed:', err);
    return NextResponse.json({ error: 'render_failed' }, { status: 500 });
  }

  return NextResponse.json({
    pngBase64: png.toString('base64'),
    spec,
    warnings,
    rowsUsed: table.rows.length,
  });
}
