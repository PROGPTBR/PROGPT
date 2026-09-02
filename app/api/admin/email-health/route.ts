import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { sendEmail, getEmailConfigStatus } from '@/lib/email/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/email-health — diagnóstico admin do SMTP (mesmo padrão de
// /api/admin/fiscal-health). Nunca expõe a senha, só se as credenciais
// estão presentes e qual remetente está configurado — o ponto principal é
// sinalizar quando EMAIL_FROM não bate com a caixa SMTP autenticada
// (SMTP_USER), gotcha comum que faz o provedor rejeitar ou marcar spam.
//
// POST { to: string } — envia um e-mail de teste de verdade via sendEmail()
// e devolve o resultado cru do SMTP, pra confirmar entrega além da config
// estática.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const { hasKey, from, isSandboxFrom } = getEmailConfigStatus();

  return NextResponse.json({
    hasKey,
    from,
    isSandboxFrom,
    warning: !hasKey
      ? 'SMTP_HOST/SMTP_USER/SMTP_PASSWORD ausente — todo envio é silenciosamente pulado (fail-soft).'
      : isSandboxFrom
        ? `EMAIL_FROM (${from}) não bate com a caixa SMTP autenticada (SMTP_USER). Muitos provedores (Titan/Hostgator incluso) rejeitam ou marcam spam nesse caso.`
        : null,
  });
}

const BodySchema = z.object({ to: z.string().email() });

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await sendEmail({
    to: parsed.data.to,
    subject: 'PROGPT — teste de entrega (admin)',
    html: '<p>Se você recebeu isso, o envio via SMTP está funcionando ponta a ponta.</p>',
  });

  return NextResponse.json(result);
}
