import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { buildWelcomeEmail } from '@/lib/email/templates';

// Sub-projeto 30 — welcome email dispara aqui (1ª vez que o user passa
// pelo callback após confirmar email). Idempotente via
// profiles.welcome_email_sent_at.

async function maybeSendWelcome(userId: string, email: string): Promise<void> {
  const svc = getServerSupabase();
  // Marca com timestamp ANTES de enviar (acquire lock) — se o send
  // falhar, perdemos o welcome mas evitamos double-send.
  const { data, error } = await svc
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id');
  if (error) {
    console.warn('[auth-callback] welcome lock failed:', error.message);
    return;
  }
  if (!data || data.length === 0) {
    // Já foi enviado antes — noop
    return;
  }
  const tpl = buildWelcomeEmail({ email });
  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    idempotencyKey: `welcome:${userId}`,
  });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/chat';
  if (code) {
    const supabase = supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user?.id && data.user.email) {
      // Fire-and-forget — não bloqueia o redirect.
      void maybeSendWelcome(data.user.id, data.user.email);
    }
  }
  return NextResponse.redirect(new URL(next, req.url));
}
