import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { listFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const QuerySchema = z.object({
  rating: z.enum(['up', 'down']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  has_comment: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  let parsed: z.infer<typeof QuerySchema>;
  try {
    parsed = QuerySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }

  const { rows } = await listFeedback({
    rating: parsed.rating,
    resolved: parsed.resolved === undefined ? undefined : parsed.resolved === 'true',
    from: parsed.from,
    to: parsed.to,
    hasComment: parsed.has_comment === undefined ? undefined : parsed.has_comment === 'true',
    limit: parsed.limit,
    offset: parsed.offset,
  });

  return NextResponse.json({ rows });
}
