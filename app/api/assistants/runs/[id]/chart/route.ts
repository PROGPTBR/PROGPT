import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { classifyItems } from '@/lib/assistants/kraljic';
import { renderKraljicChartPng } from '@/lib/assistants/kraljic-chart';
import type { KraljicParams } from '@/lib/assistants/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/chart — Kraljic bubble chart PNG.
//
// Renders the same chart that gets embedded into the .docx and .xlsx,
// so the UI can mirror what the user will see in the downloads. The
// render is deterministic on (items, sizes, colors), so we set a long
// browser cache to avoid re-rendering the canvas on every UI refresh.
//
// Owner-gated like the other run endpoints. Non-Kraljic runs return 404
// since there's no chart to render.
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
  if (run.assistant_type !== 'kraljic') {
    return new NextResponse('Not Found', { status: 404 });
  }

  let buf: Buffer;
  try {
    const kp = run.params as KraljicParams;
    const classified = classifyItems(kp.items);
    buf = await renderKraljicChartPng(classified);
  } catch (err) {
    console.warn('[chart] render failed:', err);
    return NextResponse.json({ error: 'render_failed' }, { status: 500 });
  }

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(buf.length),
      // Run params are immutable once status='done', so the chart is
      // safe to cache for the session. The query-string-less URL plus
      // browser HTTP cache keeps the UI snappy on re-renders.
      'Cache-Control': 'private, max-age=300',
    },
  });
}
