import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { classifyItems } from '@/lib/assistants/kraljic';
import { renderKraljicChartPng } from '@/lib/assistants/kraljic-chart';
import { classifyAbc } from '@/lib/assistants/abc';
import { renderAbcChartPng } from '@/lib/assistants/abc-chart';
import { scoreSuppliers } from '@/lib/assistants/scorecard';
import { renderScorecardChartPng } from '@/lib/assistants/scorecard-chart';
import type { KraljicParams, AbcParams, ScorecardParams } from '@/lib/assistants/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/chart — Kraljic bubble OR ABC curve PNG.
//
// Dispatches by run.assistant_type. Owner-gated like the other run
// endpoints. Non-supported types return 404. Same rendering function
// the .docx and .xlsx routes use, so the on-screen image and the
// downloaded artifact stay byte-identical.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });

  let buf: Buffer;
  try {
    if (run.assistant_type === 'kraljic') {
      const kp = run.params as KraljicParams;
      const classified = classifyItems(kp.items);
      buf = await renderKraljicChartPng(classified);
    } else if (run.assistant_type === 'abc') {
      const ap = run.params as AbcParams;
      const analysis = classifyAbc(ap);
      buf = await renderAbcChartPng(analysis);
    } else if (run.assistant_type === 'scorecard') {
      const sp = run.params as unknown as ScorecardParams;
      buf = await renderScorecardChartPng(scoreSuppliers(sp), sp.thresholds);
    } else {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (err) {
    console.warn('[chart] render failed:', err);
    return NextResponse.json({ error: 'render_failed' }, { status: 500 });
  }

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=300',
    },
  });
}
