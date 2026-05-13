import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { mdToDocxBuffer } from '@/lib/assistants/docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/docx — download the generated RFP as .docx.
// Renders on-demand from output_md (source of truth); no blob persisted.
//
// Owner-gated: getRunForOwner() filters by user_id. Non-owners receive 404
// (not 403) to avoid revealing run existence.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const scope = (run.params as { scope?: string }).scope ?? 'RFP';
  const titleSafe = `RFP - ${scope}`.slice(0, 120);
  const buf = await mdToDocxBuffer(run.output_md, titleSafe);

  // Filename derived from run id (no PII), browser saves it as a .docx.
  const filename = `rfp-${run.id.slice(0, 8)}.docx`;
  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    },
  });
}
