import { NextResponse } from 'next/server';
import { z } from 'zod';

import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { marcarEntradasTratadas } from '@/lib/medico/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ ids: z.array(z.string().uuid()).min(1).max(400) });

// POST /api/medico/entradas: marca como conferido o que chegou pelo grupo de
// WhatsApp ou por e-mail (sai da caixa de entrada).
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Pedido inválido.' }, { status: 400 });
  return (await marcarEntradasTratadas(u.id, body.data.ids))
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
}
