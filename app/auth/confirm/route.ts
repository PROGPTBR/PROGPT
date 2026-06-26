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
  const { searchParams } = new URL(req.url);

  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(req.url).origin;

  console.log('APP_URL =', process.env.APP_URL);
  console.log('NEXT_PUBLIC_APP_URL =', process.env.NEXT_PUBLIC_APP_URL);
  console.log('appUrl =', appUrl);
  console.log('req.url =', req.url);

  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/chat';

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login', appUrl));
  }

 const supabase = supabaseServer();

const { data, error } = await supabase.auth.verifyOtp({
  token_hash,
  type,
});

if (error) {
  console.log('====================');
  console.log('VERIFY OTP ERROR');
  console.dir(error, { depth: null });
  console.log('====================');

  return NextResponse.redirect(
    new URL('/login?error=invalid_token', appUrl)
  );
}

  if (type === 'signup' && data.user?.id && data.user.email) {
    void maybeSendWelcome(data.user.id, data.user.email);
  }

  if (type === 'recovery') {
    return NextResponse.redirect(
      new URL('/reset-password', appUrl)
    );
  }

  return NextResponse.redirect(
    new URL(next, appUrl)
  );
}