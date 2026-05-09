import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { resolveFeedback } from '@/lib/feedback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ resolved: z.boolean() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await resolveFeedback(params.id, body.resolved);
  if (!result.ok) {
    return NextResponse.json({ error: 'resolve_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, resolved_at: result.resolved_at });
}
