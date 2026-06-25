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

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/chat';

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = supabaseServer();

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash,
    type,
  });

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=invalid_token`);
  }

  if (type === 'signup' && data.user?.id && data.user.email) {
    void maybeSendWelcome(data.user.id, data.user.email);
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}