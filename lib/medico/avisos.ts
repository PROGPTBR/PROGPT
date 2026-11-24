import { configuredAppUrl } from '@/lib/app-url';
import { getServerSupabase } from '@/lib/db/supabase';
import { sendEmail } from '@/lib/email/client';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

import { areaMedicaLiberada } from './acesso';
import { avisoDoDia } from './aviso-texto';
import { enviarTexto, estadoDaInstancia, INSTANCIA_AVISOS, numeroLimpo, whatsappConfigurado } from './evolution';
import { carregarEstado } from './service';

// Avisos fora da tela (sub-projeto 101): uma vez por dia, de manhã, o médico
// recebe por WhatsApp e por e-mail o que está parado. Dia sem pendência não
// gera mensagem.

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export type ResultadoAviso = { enviado: boolean; email: boolean; whatsapp: boolean; motivo?: string };

/** Monta e manda o aviso de um médico. Não confere nem marca o "já enviei hoje". */
export async function enviarAvisoPara(userId: string, emailDaConta: string | null): Promise<ResultadoAviso> {
  const hoje = hojeEmBrasilia();
  const estado = await carregarEstado(userId);
  const aviso = avisoDoDia(estado, hoje, `${configuredAppUrl()}/area-medica`);
  if (!aviso) return { enviado: false, email: false, whatsapp: false, motivo: 'Nada pendente hoje.' };

  const { config } = estado;
  let email = false;
  let whatsapp = false;

  const para = config.medico_email.trim() || emailDaConta || '';
  if (config.avisos_email && para) {
    const r = await sendEmail({
      to: para,
      subject: aviso.assunto,
      text: aviso.texto,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111">${esc(aviso.texto).replace(/\n/g, '<br/>')}</div>`,
    });
    email = r.ok;
  }

  const numero = numeroLimpo(config.whatsapp_numero);
  if (config.avisos_whatsapp && numero && whatsappConfigurado()) {
    try {
      if ((await estadoDaInstancia(INSTANCIA_AVISOS)) === 'open') {
        await enviarTexto(INSTANCIA_AVISOS, numero, aviso.texto);
        whatsapp = true;
      }
    } catch (err) {
      console.error('[medico/avisos] WhatsApp falhou:', err instanceof Error ? err.message : err);
    }
  }

  return { enviado: email || whatsapp, email, whatsapp, motivo: email || whatsapp ? undefined : 'Nenhum canal de aviso está pronto (e-mail ou WhatsApp).' };
}

/**
 * Rodada diária. Cada médico é "reservado" por um UPDATE condicional em
 * `ultimo_aviso_em`: se dois processos rodarem ao mesmo tempo, só um envia.
 */
export async function enviarAvisosDoDia(): Promise<{ medicos: number; enviados: number }> {
  const hoje = hojeEmBrasilia();
  const db = getServerSupabase();
  const { data: configs } = await db
    .from('medico_config')
    .select('user_id')
    .or(`ultimo_aviso_em.is.null,ultimo_aviso_em.lt.${hoje}`)
    .or('avisos_email.eq.true,avisos_whatsapp.eq.true')
    .limit(500);

  let enviados = 0;
  for (const { user_id } of configs ?? []) {
    const { data: reservado } = await db
      .from('medico_config')
      .update({ ultimo_aviso_em: hoje })
      .eq('user_id', user_id)
      .or(`ultimo_aviso_em.is.null,ultimo_aviso_em.lt.${hoje}`)
      .select('user_id');
    if (!reservado || reservado.length === 0) continue;

    try {
      const { data: perfil } = await db.from('profiles_with_email').select('email, super_admin').eq('id', user_id).maybeSingle();
      // Quem perdeu o acesso à Área Médica deixa de receber aviso.
      if (!perfil || !areaMedicaLiberada(perfil.email as string | null, perfil.super_admin === true)) continue;
      const r = await enviarAvisoPara(user_id as string, (perfil.email as string | null) ?? null);
      if (r.enviado) enviados += 1;
    } catch (err) {
      console.error('[medico/avisos] falhou para um médico:', err instanceof Error ? err.message : err);
    }
  }
  return { medicos: configs?.length ?? 0, enviados };
}

/** Hora de Brasília (0 a 23). */
export function horaEmBrasilia(agora: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(agora)) % 24;
}

/** Os avisos saem de manhã: a rodada só envia entre 8h e 12h de Brasília. */
export function horaDeAvisar(agora: Date = new Date()): boolean {
  const h = horaEmBrasilia(agora);
  return h >= 8 && h < 12;
}
