import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs/[id]/output — return the assembled markdown.
// Used by the client after the stream ends, so the in-memory view (which
// only saw the LLM-streamed head) is replaced with the full document
// including the programmatically assembled verbatim tail.
//
// Owner-gated. Returns 409 when the run isn't done yet.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const run = await getRunForOwner(params.id, user.id);
  if (!run) return new NextResponse('Not Found', { status: 404 });
  if (run.status !== 'done' || !run.output_md) {
    return NextResponse.json({ error: 'not_ready', status: run.status }, { status: 409 });
  }

  return NextResponse.json({ output_md: run.output_md, status: run.status });
}
