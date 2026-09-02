import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, NotAdmin } from '@/lib/auth';
import { sendEmail } from '@/lib/email/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SANDBOX_FROM = 'PROGPT <onboarding@resend.dev>';

// GET /api/admin/email-health — diagnóstico admin do Resend (mesmo padrão
// de /api/admin/fiscal-health). Nunca expõe a key, só se ela existe e qual
// remetente está configurado — o ponto principal é sinalizar quando
// EMAIL_FROM ainda está no domínio sandbox (onboarding@resend.dev), que o
// Resend só entrega pro próprio dono da conta, nunca pra cliente real (ver
// docs/product/go-live-readiness.md).
//
// POST { to: string } — envia um e-mail de teste de verdade via sendEmail()
// e devolve o resultado cru do Resend, pra confirmar entrega além da
// config estática.
export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof NotAdmin) return new NextResponse('Not Found', { status: 404 });
    throw err;
  }

  const hasKey = !!process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? SANDBOX_FROM;
  const isSandboxFrom = from === SANDBOX_FROM || from.includes('@resend.dev');

  return NextResponse.json({
    hasKey,
    from,
    isSandboxFrom,
    warning: !hasKey
      ? 'RESEND_API_KEY ausente — todo envio é silenciosamente pulado (fail-soft).'
      : isSandboxFrom
        ? 'EMAIL_FROM está no domínio sandbox do Resend (onboarding@resend.dev). Nesse modo o Resend só entrega pro e-mail dono da conta — clientes reais NÃO recebem, mesmo com a API respondendo 200.'
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
    html: '<p>Se você recebeu isso, o envio via Resend está funcionando ponta a ponta.</p>',
  });

  return NextResponse.json(result);
}
