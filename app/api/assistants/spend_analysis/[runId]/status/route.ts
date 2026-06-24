import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner, failRun } from '@/lib/assistants/runs';
import { getServerSupabase } from '@/lib/db/supabase';
import { statusCountsForRun } from '@/lib/spend/db';

// GET /api/assistants/spend_analysis/[runId]/status — owner-gated. Devolve o
// status do run + contagens por status das notas (a barra de progresso é
// derivada delas). Reaper: se 'running' sem progresso há > 5 min, marca erro
// (o heartbeat é o updated_at das spend_invoices, já que assistant_runs não
// tem coluna de progresso).

const STALE_MS = 5 * 60 * 1000;

export async function GET(
  _req: Request,
  { params }: { params: { runId: string } },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.runId, user.id);
  if (!run || run.assistant_type !== 'spend_analysis') {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const counts = await statusCountsForRun(params.runId);
  let status = run.status;

  if (status === 'running') {
    const sb = getServerSupabase();
    const { data } = await sb
      .from('spend_invoices')
      .select('updated_at')
      .eq('run_id', params.runId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = (data as { updated_at: string } | null)?.updated_at;
    const lastMs = last ? Date.parse(last) : Date.now();
    if (Date.now() - lastMs > STALE_MS) {
      await failRun(params.runId, 'Análise interrompida (sem progresso por mais de 5 minutos).');
      await sb
        .from('spend_invoices')
        .update({ status: 'error', error_message: 'interrompido', updated_at: new Date().toISOString() })
        .eq('run_id', params.runId)
        .in('status', ['pending', 'extracting']);
      status = 'error';
    }
  }

  return Response.json({
    status,
    error_message: run.error_message,
    counts,
  });
}
