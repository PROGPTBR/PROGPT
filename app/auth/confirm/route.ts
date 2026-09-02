import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { ensureWelcomeEmailSent } from '@/lib/email/welcome';
import { type EmailOtpType } from '@supabase/supabase-js';
import { configuredAppUrl } from '@/lib/app-url';

// Lógica de envio do welcome email (idempotente via
// profiles.welcome_email_sent_at) centralizada em lib/email/welcome.ts.

// Só aceita caminho relativo interno (começando com "/" e não "//") — evita
// open-redirect via ?next=https://site-malicioso.
function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const appUrl = configuredAppUrl();

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'), '/chat');

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login', appUrl));
  }

  const supabase = supabaseServer();

  // verifyOtp (fluxo token_hash — resistente a filtros de e-mail que removem o
  // #fragment do link) estabelece a sessão em COOKIE via supabaseServer, que
  // /reset-password lê no browser. NÃO logar token_hash nem req.url (o token
  // viaja na query — seria vazamento de credencial no log).
  const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });

  if (error) {
    // Sem PII/token no log — só o motivo.
    console.warn('[auth/confirm] verifyOtp falhou:', error.message);
    return NextResponse.redirect(new URL('/login?error=invalid_token', appUrl));
  }

  if (type === 'signup' && data.user?.id && data.user.email) {
    void ensureWelcomeEmailSent(data.user.id, data.user.email);
  }

  // Recuperação E convite: o usuário precisa DEFINIR uma senha → tela de
  // redefinir (destino fixo — nunca redireciona pra fora, mesmo que o link
  // traga outro next). Convidado chega sem senha; define ali.
  if (type === 'recovery' || type === 'invite') {
    return NextResponse.redirect(new URL('/reset-password', appUrl));
  }

  // Confirmação de cadastro (signup) e demais: usuário já tem senha → segue.
  return NextResponse.redirect(new URL(next, appUrl));
}
