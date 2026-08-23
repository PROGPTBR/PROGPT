import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { buildRunDocx } from '@/lib/assistants/run-docx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/docx — download the generated RFP as .docx.
// Renders on-demand from output_md (source of truth); no blob persisted.
//
// A montagem em si vive em lib/assistants/run-docx.ts, compartilhada com a
// rota .../eml (backlog do diretor 2026-08-19, Batch I) pra que o anexo do
// e-mail seja byte-idêntico ao arquivo baixado aqui.
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

  const { buffer, filename } = await buildRunDocx(run, user.id);

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
