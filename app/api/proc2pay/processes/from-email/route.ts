import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { isPro } from '@/lib/billing/subscription';
import { checkChatRateLimit } from '@/lib/rate-limit';
import { structureRequisicaoFromText } from '@/lib/proc2pay/intake';
import { createProcess } from '@/lib/proc2pay/process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Proc2Pay — abre um processo a partir do texto do e-mail da produção (colado).
// A mesma estruturação é reusada pelo webhook do Resend Inbound numa fase
// seguinte. Gate Pro (feature paga).

const Body = z.object({ text: z.string().trim().min(1).max(20000) });

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    throw err;
  }

  if (!(await isPro(user.id))) {
    return NextResponse.json({ error: 'paywall', plan: 'free' }, { status: 402 });
  }

  const rl = await checkChatRateLimit();
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited', retry_after_secs: rl.retryAfterSecs }, { status: 429 });
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { requisicao, titulo } = await structureRequisicaoFromText(parsed.text, user.id);
  const process = await createProcess({ userId: user.id, requisicao, titulo, origem: 'email' });
  if (!process) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });

  return NextResponse.json({ process }, { status: 201 });
}
