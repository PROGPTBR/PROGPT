import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getProcessForOwner, recordApproval } from '@/lib/proc2pay/process';
import { canRunStage } from '@/lib/proc2pay/stages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — gate de aprovação (passo 12, 1 aprovador na v1).

const Body = z.object({
  decision: z.enum(['aprovado', 'reprovado']),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  const process = await getProcessForOwner(user.id, params.id);
  if (!process) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (!canRunStage('aprovacao', process.context)) {
    return NextResponse.json(
      { error: 'Conclua a negociação antes de aprovar.' },
      { status: 409 },
    );
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const updated = await recordApproval({
    userId: user.id,
    process,
    decision: parsed.decision,
    comment: parsed.comment,
  });
  if (!updated) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });

  return NextResponse.json({ process: updated });
}
