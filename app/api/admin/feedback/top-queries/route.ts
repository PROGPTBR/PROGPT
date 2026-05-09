import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { topQueries } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  let parsed: z.infer<typeof Query>;
  try {
    parsed = Query.parse(Object.fromEntries(url.searchParams.entries()));
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const rows = await topQueries(parsed.days, parsed.limit);
  return NextResponse.json({ rows });
}
