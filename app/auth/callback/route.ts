import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { ensureWelcomeEmailSent } from '@/lib/email/welcome';

// Sub-projeto 30 — welcome email dispara aqui (1ª vez que o user passa
// pelo callback após confirmar email, via troca de `code` — PKCE/OAuth).
// Lógica de envio (idempotente via profiles.welcome_email_sent_at)
// centralizada em lib/email/welcome.ts — ver o comentário lá pros outros
// pontos de disparo e por que existem 3.

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/chat';
  if (code) {
    const supabase = supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user?.id && data.user.email) {
      // Fire-and-forget — não bloqueia o redirect.
      void ensureWelcomeEmailSent(data.user.id, data.user.email);
    }
  }
  return NextResponse.redirect(new URL(next, req.url));
}
