import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/db/supabase-server';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { buildWelcomeEmail } from '@/lib/email/templates';





async function maybeSendWelcome(userId: string, email: string): Promise<void> {
  const svc = getServerSupabase();

  const { data, error } = await svc
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', userId)
    .is('welcome_email_sent_at', null)
    .select('id');

  if (error || !data?.length) return;

  const tpl = buildWelcomeEmail({ email });

  await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    idempotencyKey: `welcome:${userId}`,
  });
}

export async function GET(req: NextRequest) {

  console.log('================================');
  console.log('CALLBACK');
  console.log(req.url);
  console.log(req.nextUrl.search);
  console.log(req.nextUrl.searchParams.toString());
  console.log('================================');

  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/chat';

  if (code) {
    const supabase = supabaseServer();

    const { data, error } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.user?.id && data.user.email) {
      void maybeSendWelcome(data.user.id, data.user.email);
    }
  }

  return NextResponse.redirect(new URL(next, req.url));
}