import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { buildWelcomeEmail } from '@/lib/email/templates';
import { type EmailOtpType } from '@supabase/supabase-js';

async function maybeSendWelcome(userId: string, email: string) {
  const svc = getServerSupabase();

  const { data } = await svc
    .from('profiles')
    .update({
      welcome_email_sent_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id');

  if (!data?.length) return;

  const tpl = buildWelcomeEmail({ email });

  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    idempotencyKey: `welcome:${userId}`,
  });
}

// Só aceita caminho relativo interno (começando com "/" e não "//") — evita
// open-redirect via ?next=https://site-malicioso.
function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  return raw;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(req.url).origin;

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
    void maybeSendWelcome(data.user.id, data.user.email);
  }

  // Recuperação de senha: manda pra tela de redefinir (destino fixo — nunca
  // redireciona pra fora, mesmo que o link traga outro next).
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/reset-password', appUrl));
  }

  return NextResponse.redirect(new URL(next, appUrl));
}