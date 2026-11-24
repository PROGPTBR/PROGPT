import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getServerSupabase } from '@/lib/db/supabase';
import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { desconectarBanco } from '@/lib/medico/btg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// DELETE /api/medico/btg: desliga a conta (os movimentos já gravados ficam).
export async function DELETE() {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  await desconectarBanco(u.id);
  return NextResponse.json({ ok: true });
}

const Vinculo = z.object({ movimento_id: z.string().uuid(), demonstrativo_id: z.string().uuid().nullable() });

// PATCH /api/medico/btg: liga (ou solta) um crédito à nota que ele pagou.
export async function PATCH(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = Vinculo.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Pedido inválido.' }, { status: 400 });
  const db = getServerSupabase();
  if (body.data.demonstrativo_id) {
    const { data } = await db.from('medico_demonstrativos').select('id').eq('user_id', u.id).eq('id', body.data.demonstrativo_id).maybeSingle();
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const { error } = await db.from('medico_movimentos').update({ demonstrativo_id: body.data.demonstrativo_id }).eq('user_id', u.id).eq('id', body.data.movimento_id);
  return error ? NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 }) : NextResponse.json({ ok: true });
}
