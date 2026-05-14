import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listRunsForOwner } from '@/lib/assistants/runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs?limit=50
// List the current user's past assistant runs (most recent first).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50;

  const runs = await listRunsForOwner(user.id, limit);
  return NextResponse.json({ runs });
}
