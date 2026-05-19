import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { buildCotacaoXlsxBuffer } from '@/lib/assistants/xlsx';
import { buildKraljicXlsxBuffer } from '@/lib/assistants/kraljic-xlsx';
import { classifyItems } from '@/lib/assistants/kraljic';
import { renderKraljicChartPng } from '@/lib/assistants/kraljic-chart';
import { buildAbcXlsxBuffer } from '@/lib/assistants/abc-xlsx';
import { classifyAbc } from '@/lib/assistants/abc';
import { renderAbcChartPng } from '@/lib/assistants/abc-chart';
import { getUserLogoBuffer } from '@/lib/db/user-logos';
import type {
  RfpParams,
  KraljicParams,
  AbcParams,
} from '@/lib/assistants/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/xlsx — dispatches by assistant_type.
//   rfp     → Cotação spreadsheet (legacy)
//   kraljic → 4-sheet workbook (Resumo + Matriz with chart + Itens + Plano)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done') {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  const logo = await getUserLogoBuffer(user.id);

  let buf: Buffer;
  let filename: string;
  if (run.assistant_type === 'kraljic') {
    const kraljicParams = run.params as KraljicParams;
    const classified = classifyItems(kraljicParams.items);
    let chartPng: Buffer | undefined;
    try {
      chartPng = await renderKraljicChartPng(classified);
    } catch (err) {
      console.warn('[xlsx] kraljic chart render failed:', err);
    }
    buf = await buildKraljicXlsxBuffer(kraljicParams, classified, {
      logo: logo ?? undefined,
      chartPng,
    });
    filename = `kraljic-${run.id.slice(0, 8)}.xlsx`;
  } else if (run.assistant_type === 'abc') {
    const abcParams = run.params as AbcParams;
    const analysis = classifyAbc(abcParams);
    let chartPng: Buffer | undefined;
    try {
      chartPng = await renderAbcChartPng(analysis);
    } catch (err) {
      console.warn('[xlsx] abc chart render failed:', err);
    }
    buf = await buildAbcXlsxBuffer(abcParams, analysis, {
      logo: logo ?? undefined,
      chartPng,
    } as Parameters<typeof buildAbcXlsxBuffer>[2]);
    filename = `abc-${run.id.slice(0, 8)}.xlsx`;
  } else {
    buf = await buildCotacaoXlsxBuffer(run.params as RfpParams, {
      logo: logo ?? undefined,
    });
    filename = `cotacao-${run.id.slice(0, 8)}.xlsx`;
  }

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
