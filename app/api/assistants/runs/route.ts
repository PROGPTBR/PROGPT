import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listRunsForOwner } from '@/lib/assistants/runs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/assistants/runs?limit=50&cursor=<iso>
// Paginated list of the current user's assistant runs (most recent first).
// `cursor` is the `created_at` of the last row from the previous page;
// rows older than it are returned. Response includes `nextCursor` (null
// when no more pages).
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get('limit') ?? '50');
  const limit = Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50;
  const cursor = url.searchParams.get('cursor');

  const { runs, nextCursor } = await listRunsForOwner(user.id, limit, cursor);
  return NextResponse.json({ runs, nextCursor });
}
