/* eslint-disable @typescript-eslint/no-explicit-any -- respostas e webhooks da Evolution API não têm tipo publicado */
import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

import { getServerSupabase } from '@/lib/db/supabase';
import { textoDaMensagem, tokenInterno, userIdDaInstancia } from '@/lib/medico/evolution';
import { registrarEntrada } from '@/lib/medico/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Webhook da Evolution (MESSAGES_UPSERT) para as instâncias dos médicos
// (sub-projeto 101). Só guarda mensagem de TEXTO do grupo que o médico
// escolheu; conversa particular e outros grupos são descartados aqui mesmo,
// sem gravar nada. Sempre 200 nos casos benignos, para a Evolution não
// reenviar em laço.

function tokenConfere(recebido: string | null): boolean {
  const esperado = tokenInterno('whatsapp');
  if (!esperado || !recebido || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

export async function POST(req: Request) {
  if (!tokenConfere(new URL(req.url).searchParams.get('token'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const corpo = (await req.json().catch(() => null)) as { event?: string; instance?: string; data?: unknown } | null;
  const evento = String(corpo?.event ?? '').toLowerCase().replace(/_/g, '.');
  const userId = userIdDaInstancia(String(corpo?.instance ?? ''));
  if (!corpo || evento !== 'messages.upsert' || !userId) return NextResponse.json({ ok: true, ignored: true });

  const { data: config } = await getServerSupabase().from('medico_config').select('grupo_jid').eq('user_id', userId).maybeSingle();
  const grupo = (config?.grupo_jid as string | undefined) ?? '';
  if (!grupo) return NextResponse.json({ ok: true, sem_grupo: true });

  const mensagens = Array.isArray(corpo.data) ? corpo.data : [corpo.data];
  let gravadas = 0;
  for (const m of mensagens as any[]) {
    if (m?.key?.remoteJid !== grupo || !m?.key?.id) continue;
    const texto = textoDaMensagem(m);
    if (texto.length < 3) continue;
    const ts = Number(m.messageTimestamp);
    await registrarEntrada(userId, {
      canal: 'whatsapp',
      origem_id: String(m.key.id),
      remetente: m.key.fromMe ? 'Você' : String(m.pushName ?? ''),
      texto: texto.slice(0, 4000),
      ...(Number.isFinite(ts) && ts > 0 ? { recebido_em: new Date(ts * 1000).toISOString() } : {}),
    });
    gravadas += 1;
  }
  return NextResponse.json({ ok: true, gravadas });
}
