import { NextResponse } from 'next/server';
import { z } from 'zod';

import { acceptInvite } from '@/lib/billing/seat-members';
import { checkAnonRateLimit } from '@/lib/rate-limit';
import { getClientIp, hashIp } from '@/lib/captcha';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Aceite de convite de licença (sub-projeto 64). Rota PÚBLICA — quem abre o
// link ainda não tem sessão. O token (32 bytes aleatórios, uso único) é a
// credencial; rate-limit por IP limita tentativa de adivinhação.
const Body = z.object({
  password: z.string().max(200).optional().default(''),
  fullName: z.string().trim().max(120).optional().default(''),
});

const REASON_MESSAGE: Record<string, string> = {
  invalid_token: 'Este convite não é mais válido. Peça um novo para quem contratou.',
  already_accepted: 'Este convite já foi usado. Entre normalmente com seu e-mail e senha.',
  weak_password: 'Escolha uma senha com pelo menos 8 caracteres.',
  create_failed: 'Não foi possível concluir agora. Tente de novo em instantes.',
};

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const rate = await checkAnonRateLimit('seat-invite', hashIp(getClientIp(req)));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
  }

  const result = await acceptInvite({
    token: params.token,
    password: body.password,
    fullName: body.fullName || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: REASON_MESSAGE[result.reason] ?? 'Não foi possível concluir.' },
      { status: result.reason === 'create_failed' ? 500 : 400 },
    );
  }

  // `created: false` = a pessoa já tinha conta; a senha dela não foi tocada.
  return NextResponse.json({ ok: true, email: result.email, created: result.created });
}
