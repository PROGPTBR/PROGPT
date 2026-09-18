import { NextResponse } from 'next/server';

import { requireUser, NotAuthenticated, getProfile } from '@/lib/auth';
import { getPendingToken, sendSeatInvite } from '@/lib/billing/seat-members';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Reenvia o convite pendente (o token é o mesmo — não invalida o anterior).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const pending = await getPendingToken(user.id, params.id);
  if (!pending) {
    return NextResponse.json(
      { error: 'Este convite não está mais pendente.' },
      { status: 404 },
    );
  }

  const profile = await getProfile(user.id).catch(() => null);

  const sent = await sendSeatInvite({
    to: pending.email,
    token: pending.token,
    inviterName:
      (profile as { full_name?: string | null; display_name?: string | null } | null)?.full_name ??
      (profile as { display_name?: string | null } | null)?.display_name ??
      null,
    inviterEmail: user.email ?? null,
  });

  if (!sent.ok) {
    return NextResponse.json(
      { error: 'Não conseguimos enviar o e-mail agora. Tente de novo em instantes.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
