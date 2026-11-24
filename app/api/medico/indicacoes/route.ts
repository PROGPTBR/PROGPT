import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/db/supabase';
import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import { IndicacoesSchema } from '@/lib/medico/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/medico/indicacoes: o médico indica colegas (um, ou uma lista de
// contatos). O sistema só guarda: quem fala com o colega é o próprio médico,
// pelo WhatsApp dele, ou a equipe da 2B Supply. Nada é enviado sozinho a quem
// não pediu.
export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  const body = IndicacoesSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Informe o nome e o WhatsApp ou e-mail do colega.' }, { status: 400 });
  const { data, error } = await getServerSupabase()
    .from('medico_indicacoes')
    .upsert(body.data.indicacoes.map((i) => ({ user_id: u.id, ...i })), { onConflict: 'user_id,contato', ignoreDuplicates: true })
    .select('id');
  if (error) return NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
  return NextResponse.json({ ok: true, novas: data?.length ?? 0 });
}
