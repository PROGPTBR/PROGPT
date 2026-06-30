import { NextResponse } from 'next/server';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getProcessForOwner, listStageRuns } from '@/lib/proc2pay/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — detalhe de um processo + histórico de etapas (owner-only).

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const process = await getProcessForOwner(user.id, params.id);
  if (!process) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const stageRuns = await listStageRuns(user.id, params.id);
  return NextResponse.json({ process, stageRuns });
}
