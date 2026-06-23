import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bodyToHtml(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(
    body,
  )}</div>`;
}

// POST — APROVA e ENVIA a resposta ao fornecedor (via Resend). Só aqui sai
// e-mail de verdade — a aprovação humana é obrigatória.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const svc = getServerSupabase();
  const { data: reply } = await svc
    .from('comprador_replies')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!reply) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (reply.status === 'sent') {
    return NextResponse.json({ error: 'already_sent' }, { status: 409 });
  }
  if (!reply.to_email) {
    return NextResponse.json({ error: 'no_recipient' }, { status: 400 });
  }

  const sent = await sendEmail({
    to: reply.to_email,
    subject: reply.subject || 'Resposta sobre sua proposta',
    html: bodyToHtml(reply.body),
    idempotencyKey: `comprador-reply:${reply.id}`,
  });
  if (!sent.ok) {
    return NextResponse.json({ error: 'send_failed' }, { status: 502 });
  }

  const now = new Date().toISOString();
  const { data: updated } = await svc
    .from('comprador_replies')
    .update({ status: 'sent', sent_at: now })
    .eq('id', reply.id)
    .eq('user_id', user.id)
    .select()
    .single();

  await svc
    .from('comprador_quotes')
    .update({ status: 'replied', updated_at: now })
    .eq('id', reply.quote_id)
    .eq('user_id', user.id);

  return NextResponse.json({ reply: updated, emailId: sent.id });
}
