import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { parseSpendImport } from '@/lib/spend/sheet-import';
import { insertSheetInvoices, countInvoicesForRun } from '@/lib/spend/db';
import { SPEND_MAX_FILE_BYTES, SPEND_MAX_INVOICES } from '@/lib/assistants/types';

// POST /api/assistants/spend_analysis/[runId]/sheet — importa uma planilha
// (XLSX/CSV) e insere as linhas como invoices (source 'sheet', status done;
// categoria pode ficar null → o pipeline classifica).

export async function POST(
  req: Request,
  { params }: { params: { runId: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.runId, user.id);
  if (!run || run.assistant_type !== 'spend_analysis') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (run.status !== 'running') {
    return Response.json({ error: 'run_not_open' }, { status: 409 });
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get('file');
    if (f instanceof File) file = f;
  } catch {
    return Response.json({ error: 'invalid_form' }, { status: 400 });
  }
  if (!file) return Response.json({ error: 'no_file' }, { status: 400 });
  if (file.size > SPEND_MAX_FILE_BYTES) {
    return Response.json({ error: 'file_too_large' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const { rows, warnings } = await parseSpendImport({
    buf,
    mime: file.type,
    filename: file.name,
  });
  if (rows.length === 0) {
    return Response.json({ inserted: 0, warnings }, { status: 200 });
  }

  const existing = await countInvoicesForRun(params.runId);
  const room = SPEND_MAX_INVOICES - existing;
  if (room <= 0) {
    return Response.json({ error: 'limit_reached', max: SPEND_MAX_INVOICES }, { status: 400 });
  }
  const capped = rows.slice(0, room);
  if (capped.length < rows.length) {
    warnings.push(`Limite de ${SPEND_MAX_INVOICES} notas: ${rows.length - capped.length} linha(s) ignorada(s).`);
  }

  const inserted = await insertSheetInvoices({
    runId: params.runId,
    userId: user.id,
    filename: file.name.replace(/[^\w.\-]/g, '_').slice(0, 120),
    rows: capped,
  });

  return Response.json({ inserted, warnings });
}
