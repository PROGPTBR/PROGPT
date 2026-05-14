import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { buildCotacaoXlsxBuffer } from '@/lib/assistants/xlsx';
import type { RfpParams } from '@/lib/assistants/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/xlsx — companion spreadsheet for the RFP.
// Section 5 (Cotação) is fiscally rich and suppliers fill it in Excel —
// markdown tables are a poor fit. This emits a fresh .xlsx every call,
// derived from the run's params (no persistence needed).
//
// Owner-gated via getRunForOwner. The run must be done — same gate as
// the docx route, for consistency.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done') {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const buf = await buildCotacaoXlsxBuffer(run.params as RfpParams);
  const filename = `cotacao-${run.id.slice(0, 8)}.xlsx`;

  return new NextResponse(buf as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buf.length),
    },
  });
}
