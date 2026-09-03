import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { ensureWelcomeEmailSent } from '@/lib/email/welcome';
import { configuredAppUrl } from '@/lib/app-url';

// Sub-projeto 30 — welcome email dispara aqui (1ª vez que o user passa
// pelo callback após confirmar email, via troca de `code` — PKCE/OAuth).
// Lógica de envio (idempotente via profiles.welcome_email_sent_at)
// centralizada em lib/email/welcome.ts — ver o comentário lá pros outros
// pontos de disparo e por que existem 3.

// Só aceita caminho relativo interno (começando com "/" e não "//") — evita
// open-redirect via ?next=https://site-malicioso (mesmo guard de
// app/auth/confirm/route.ts).
function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = safeNext(req.nextUrl.searchParams.get('next'), '/chat');
  if (code) {
    const supabase = supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user?.id && data.user.email) {
      // Fire-and-forget — não bloqueia o redirect.
      void ensureWelcomeEmailSent(data.user.id, data.user.email);
    }
  }
  // Base FIXA (configuredAppUrl), nunca req.url — atrás do proxy do Railway
  // req.url pode resolver pro host interno do container (0.0.0.0), gerando
  // um redirect que o navegador do usuário não consegue alcançar
  // (ERR_CONNECTION_REFUSED). Bug real, achado 2026-09-02.
  return NextResponse.redirect(new URL(next, configuredAppUrl()));
}
