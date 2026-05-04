import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { recordFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';

const Body = z.object({
  sessionId: z.string().uuid(),
  traceId: z.string().min(1).max(200),
  rating: z.enum(['up', 'down']),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    );
  }

  const result = await recordFeedback({
    userId: user.id,
    sessionId: parsed.sessionId,
    traceId: parsed.traceId,
    rating: parsed.rating,
    comment: parsed.comment,
  });

  if (!result.ok) {
    return Response.json({ error: 'feedback failed' }, { status: result.status });
  }

  return new Response(null, { status: 204 });
}
