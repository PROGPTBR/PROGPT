import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { getSeatState, inviteSeat, sendSeatInvite } from '@/lib/billing/seat-members';
import { getProfile } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Licenças da assinatura do próprio usuário (sub-projeto 64).
// GET  → quantos acessos ele tem, quantos usou, quem são.
// POST → convida um colega por e-mail (consome uma vaga).

const Body = z.object({ email: z.string().trim().max(255) });

const REASON_MESSAGE: Record<string, string> = {
  invalid_email: 'Informe um e-mail válido.',
  no_subscription: 'Não encontramos uma assinatura ativa nesta conta.',
  no_seats_available: 'Todos os acessos do seu plano já estão em uso. Remova um acesso ou aumente o plano.',
  already_invited: 'Este e-mail já tem um acesso nesta assinatura.',
  self: 'Este e-mail é o seu — sua conta já é o primeiro acesso.',
  persist_failed: 'Não foi possível criar o convite agora. Tente de novo em instantes.',
};

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const state = await getSeatState(user.id);
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  }

  const result = await inviteSeat({
    ownerId: user.id,
    ownerEmail: user.email ?? null,
    email: body.email,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: REASON_MESSAGE[result.reason] ?? 'Não foi possível convidar.' },
      { status: result.reason === 'persist_failed' ? 500 : 400 },
    );
  }

  const profile = await getProfile(user.id).catch(() => null);

  // Fail-soft: a licença já existe mesmo que o e-mail não saia — a UI
  // mostra o estado e oferece reenviar.
  const sent = await sendSeatInvite({
    to: result.seat.email,
    token: result.token,
    inviterName:
      (profile as { full_name?: string | null; display_name?: string | null } | null)?.full_name ??
      (profile as { display_name?: string | null } | null)?.display_name ??
      null,
    inviterEmail: user.email ?? null,
  });

  const state = await getSeatState(user.id);
  return NextResponse.json({ ok: true, emailSent: sent.ok, ...state });
}
