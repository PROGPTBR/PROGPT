import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getProfile } from '@/lib/auth';
import { medicoOuErro } from '@/lib/medico/acesso-servidor';
import {
  conectar,
  desconectar,
  estadoDaInstancia,
  EvolutionErro,
  gruposDaInstancia,
  INSTANCIA_AVISOS,
  instanciaDoMedico,
  origemPublica,
  whatsappConfigurado,
} from '@/lib/medico/evolution';
import { salvarConfig } from '@/lib/medico/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// WhatsApp da Área Médica (sub-projeto 101).
//   alvo=medico: o WhatsApp do próprio médico (lê o grupo das cirurgias e
//                manda a cobrança ao paciente).
//   alvo=avisos: o número da 2B Supply que envia os avisos diários. Só super
//                admin mexe.

const semWhatsapp = () =>
  NextResponse.json({ error: 'sem_whatsapp', message: 'O WhatsApp ainda não está ligado no servidor.' }, { status: 503 });

async function instanciaDoAlvo(userId: string, alvo: string | null): Promise<string | NextResponse> {
  if (alvo !== 'avisos') return instanciaDoMedico(userId);
  const profile = await getProfile(userId).catch(() => null);
  if (profile?.super_admin !== true) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return INSTANCIA_AVISOS;
}

export async function GET(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  if (!whatsappConfigurado()) return NextResponse.json({ estado: 'close', grupos: [], configurado: false });
  const params = new URL(req.url).searchParams;
  const instancia = await instanciaDoAlvo(u.id, params.get('alvo'));
  if (instancia instanceof NextResponse) return instancia;

  const estado = await estadoDaInstancia(instancia);
  let grupos: { jid: string; nome: string }[] = [];
  if (estado === 'open' && params.get('grupos') === '1') {
    grupos = await gruposDaInstancia(instancia).catch((e) => {
      console.error('[medico/whatsapp] grupos:', e instanceof Error ? e.message : e);
      return [];
    });
  }
  return NextResponse.json({ estado, grupos, configurado: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const Body = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('conectar'), alvo: z.enum(['medico', 'avisos']).default('medico') }),
  z.object({ acao: z.literal('desconectar'), alvo: z.enum(['medico', 'avisos']).default('medico') }),
  z.object({ acao: z.literal('grupo'), jid: z.string().max(80), nome: z.string().max(200) }),
]);

export async function POST(req: Request) {
  const u = await medicoOuErro();
  if (u instanceof NextResponse) return u;
  if (!whatsappConfigurado()) return semWhatsapp();
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'invalid_body', message: 'Pedido inválido.' }, { status: 400 });

  try {
    if (body.data.acao === 'grupo') {
      const jid = body.data.jid;
      if (jid && !jid.endsWith('@g.us')) return NextResponse.json({ error: 'invalid_body', message: 'Escolha um grupo.' }, { status: 400 });
      const ok = await salvarConfig(u.id, { grupo_jid: jid, grupo_nome: jid ? body.data.nome : '' });
      if (ok && jid) await conectar(instanciaDoMedico(u.id), true, origemPublica(req)).catch(() => undefined);
      return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'persist_failed', message: 'Não foi possível salvar agora.' }, { status: 500 });
    }
    const instancia = await instanciaDoAlvo(u.id, body.data.alvo);
    if (instancia instanceof NextResponse) return instancia;
    if (body.data.acao === 'conectar') {
      return NextResponse.json(await conectar(instancia, body.data.alvo === 'medico', origemPublica(req)), { headers: { 'Cache-Control': 'private, no-store' } });
    }
    await desconectar(instancia);
    if (body.data.alvo === 'medico') await salvarConfig(u.id, { grupo_jid: '', grupo_nome: '' });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[medico/whatsapp]', err instanceof Error ? err.message : err);
    const message = err instanceof EvolutionErro ? 'O servidor do WhatsApp não respondeu. Tente de novo em instantes.' : 'Não foi possível concluir agora.';
    return NextResponse.json({ error: 'falhou', message }, { status: 502 });
  }
}
