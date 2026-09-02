import { NextResponse } from 'next/server';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { ensureWelcomeEmailSent } from '@/lib/email/welcome';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fallback do welcome email — chamado 1x pelo <ChatRoot/> ao montar (ver
// lib/email/welcome.ts pro porquê de existirem 3 pontos de disparo).
// Cobre o caso em que a sessão do usuário é estabelecida no browser via
// fragment de URL (#access_token=...) sem passar pelas rotas de servidor
// /auth/callback ou /auth/confirm — ex.: link de confirmação gerado em
// flow "implicit" em vez de PKCE. Idempotente (lock em
// profiles.welcome_email_sent_at), então chamar de novo em toda sessão é
// barato e seguro.
export async function POST() {
  try {
    const user = await requireUser();
    if (!user.email) {
      return NextResponse.json({ ok: true });
    }
    void ensureWelcomeEmailSent(user.id, user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotAuthenticated) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }
}
