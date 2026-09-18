import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getSeatState, revokeSeat } from '@/lib/billing/seat-members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Remove um acesso. Libera a vaga na hora e o convidado perde o acesso no
// próximo request (o RPC de acesso ignora licenças revogadas). A conta dele
// continua existindo — só deixa de ser paga por esta assinatura.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const ok = await revokeSeat(user.id, params.id);
  if (!ok) {
    return NextResponse.json({ error: 'Acesso não encontrado.' }, { status: 404 });
  }

  const state = await getSeatState(user.id);
  return NextResponse.json({ ok: true, ...state });
}
