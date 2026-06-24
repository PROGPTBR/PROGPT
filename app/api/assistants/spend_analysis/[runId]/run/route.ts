import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { countInvoicesForRun } from '@/lib/spend/db';
import { runSpendPipeline } from '@/lib/spend/pipeline';

// POST /api/assistants/spend_analysis/[runId]/run — dispara o worker
// fire-and-forget (NÃO aguardar: o processo long-lived do Railway o mantém
// vivo). Retorna {ok:true} na hora; o cliente acompanha pelo /status.

export async function POST(
  _req: Request,
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

  const n = await countInvoicesForRun(params.runId);
  if (n === 0) {
    return Response.json({ error: 'no_invoices' }, { status: 400 });
  }

  // Fire-and-forget — não await.
  void runSpendPipeline(params.runId);

  return Response.json({ ok: true, invoices: n });
}
