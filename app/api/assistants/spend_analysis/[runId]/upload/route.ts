import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { uploadToSpendBucket } from '@/lib/db/spend-storage';
import { insertPdfInvoice, countInvoicesForRun } from '@/lib/spend/db';
import { SPEND_MAX_FILE_BYTES, SPEND_MAX_INVOICES } from '@/lib/assistants/types';

// POST /api/assistants/spend_analysis/[runId]/upload — sobe UMA invoice PDF
// para o bucket spend-uploads + cria a linha em spend_invoices (status pending).

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

  const existing = await countInvoicesForRun(params.runId);
  if (existing >= SPEND_MAX_INVOICES) {
    return Response.json(
      { error: 'limit_reached', max: SPEND_MAX_INVOICES },
      { status: 400 },
    );
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

  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) return Response.json({ error: 'unsupported_type' }, { status: 400 });
  if (file.size > SPEND_MAX_FILE_BYTES) {
    return Response.json(
      { error: 'file_too_large', max_bytes: SPEND_MAX_FILE_BYTES },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]/g, '_').slice(0, 120);
  const storagePath = `${user.id}/${params.runId}/${crypto.randomUUID()}-${safeName}`;

  try {
    await uploadToSpendBucket(storagePath, buf, 'application/pdf');
  } catch (err) {
    return Response.json(
      { error: 'storage_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }

  const row = await insertPdfInvoice({
    runId: params.runId,
    userId: user.id,
    storagePath,
    filename: safeName,
  });
  if (!row) return Response.json({ error: 'insert_failed' }, { status: 500 });

  return Response.json({ invoiceId: row.id });
}
