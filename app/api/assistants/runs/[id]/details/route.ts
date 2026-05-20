import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/details — returns the params of an
// assistant_run owned by the caller. Used by the "Iniciar de um Perfil"
// picker (sub-projeto 33) to read the Profile params and pre-populate
// the destination form. Could also serve other future per-run views.
//
// Why a separate endpoint vs reusing /runs?: /runs returns a list of
// summaries (drops output_md). This returns ONE row's params (which is
// what the picker needs) without including output_md (still ~kb to
// avoid wire-bloating). Owner-gated.
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

  return NextResponse.json({
    id: run.id,
    assistant_type: run.assistant_type,
    params: run.params,
    status: run.status,
    created_at: run.created_at,
  });
}
