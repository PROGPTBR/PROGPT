import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { INGEST_BUCKET } from '@/lib/db/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_RUNNING_MINUTES = 5;
const DONE_RETENTION_DAYS = 7;
// Error jobs are preserved past the done window so the admin has time to
// retry. After this many days they are reaped, including the original
// upload in Storage (otherwise the bucket fills with abandoned PDFs).
const ERROR_RETENTION_DAYS = 30;

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const sb = getServerSupabase();

  // Cleanup 1: delete done jobs older than 7 days. (Storage was already
  // removed by the pipeline on the happy path.)
  const cutoffDone = new Date(Date.now() - DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await sb.from('ingestion_jobs').delete().eq('status', 'done').lt('finished_at', cutoffDone);

  // Cleanup 2: reap error jobs older than 30 days, AND remove their
  // upload from Storage (the pipeline intentionally preserves it for
  // retry, but after 30 days we treat it as abandoned).
  const cutoffError = new Date(Date.now() - ERROR_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleErrorRows } = await sb
    .from('ingestion_jobs')
    .select('id, storage_path')
    .eq('status', 'error')
    .lt('finished_at', cutoffError);
  const stalePaths = (staleErrorRows ?? [])
    .map((r) => (r as { storage_path: string | null }).storage_path)
    .filter((p): p is string => !!p);
  if (stalePaths.length > 0) {
    await sb.storage.from(INGEST_BUCKET).remove(stalePaths);
  }
  if ((staleErrorRows ?? []).length > 0) {
    const staleIds = (staleErrorRows ?? []).map(
      (r) => (r as { id: string }).id,
    );
    await sb.from('ingestion_jobs').delete().in('id', staleIds);
  }

  // Cleanup 3: mark stale-running jobs as error.
  const cutoffStale = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString();
  await sb
    .from('ingestion_jobs')
    .update({
      status: 'error',
      error_message: 'Job interrompido (sem progresso por mais de 5 minutos)',
      finished_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('updated_at', cutoffStale);

  // List jobs ordered: running, queued, error, done; then created_at desc within group.
  const { data, error } = await sb
    .from('ingestion_jobs')
    .select(
      'id, filename, status, stage, progress, chunks_count, error_message, created_at, updated_at, finished_at, mime_type, size_bytes',
    )
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'list_failed' }, { status: 500 });

  const priority: Record<string, number> = { running: 0, queued: 1, error: 2, done: 3 };
  const jobs = (data ?? []).slice().sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const pa = priority[a.status as string] ?? 9;
    const pb = priority[b.status as string] ?? 9;
    if (pa !== pb) return pa - pb;
    return (b.created_at as string).localeCompare(a.created_at as string);
  });

  return NextResponse.json({ jobs });
}

export async function DELETE() {
  let userId: string;
  try {
    const { user } = await requireAdmin();
    userId = user.id;
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const sb = getServerSupabase();

  // First, gather storage paths for the error jobs about to be deleted —
  // the pipeline preserves the upload on error so the admin can retry,
  // and a manual clear should also free that storage.
  const { data: toRemove } = await sb
    .from('ingestion_jobs')
    .select('id, storage_path, status')
    .in('status', ['done', 'error'])
    .eq('user_id', userId);
  const errorPaths = (toRemove ?? [])
    .filter(
      (r) =>
        (r as { status: string }).status === 'error' &&
        (r as { storage_path: string | null }).storage_path,
    )
    .map((r) => (r as { storage_path: string }).storage_path);
  if (errorPaths.length > 0) {
    await sb.storage.from(INGEST_BUCKET).remove(errorPaths);
  }

  const { data, error } = await sb
    .from('ingestion_jobs')
    .delete()
    .in('status', ['done', 'error'])
    .eq('user_id', userId)
    .select('id');

  if (error) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: (data ?? []).length });
}
