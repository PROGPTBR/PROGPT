import { NextResponse } from 'next/server';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { getServerSupabase } from '@/lib/db/supabase';
import { resendWelcomeEmail } from '@/lib/email/welcome';
import { getEmailConfigStatus } from '@/lib/email/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/users/[id]/resend-welcome-email — reenvio manual (admin)
// do welcome email (com magic link de acesso automático), pra cliente que
// relata não ter recebido. Ignora o lock de "1x por usuário" de propósito
// — ver lib/email/welcome.ts (resendWelcomeEmail).
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const sb = getServerSupabase();
  const { data, error } = await sb
    .from('profiles_with_email')
    .select('email')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !data?.email) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const result = await resendWelcomeEmail(params.id, data.email);
  if (!result.ok) {
    // Sinaliza a causa mais provável junto do erro cru do Resend, pra não
    // obrigar o admin a ir checar /api/admin/email-health à parte.
    const config = getEmailConfigStatus();
    return NextResponse.json(
      {
        error: 'send_failed',
        detail: result.error ?? null,
        hint: !config.hasKey
          ? 'RESEND_API_KEY ausente no ambiente.'
          : config.isSandboxFrom
            ? `EMAIL_FROM (${config.from}) está no domínio sandbox do Resend — só entrega pro dono da conta, nunca pra cliente real.`
            : null,
      },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
