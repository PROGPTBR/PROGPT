import { getProfile } from '@/lib/auth';
import { getEmailConfigStatus } from '@/lib/email/client';
import { inboundDomain } from '@/lib/email/inbound';

import { btgConfigurado } from './btg';
import { whatsappConfigurado } from './evolution';
import { carregarEstado } from './service';
import type { EstadoMedico, Integracoes } from './types';

// O que está ligado no servidor para a Área Médica (sub-projeto 101), e o
// endereço de e-mail de entrada de cada médico.
//
//   medico-<userId sem hífens>@<RESEND_INBOUND_DOMAIN>
//
// O médico cria no e-mail dele um encaminhamento automático dos e-mails do
// hospital para esse endereço. Determinístico: não precisa de tabela.

export function aliasDoMedico(userId: string): string | null {
  const d = inboundDomain();
  return d ? `medico-${userId.replace(/-/g, '').toLowerCase()}@${d}` : null;
}

export function userIdDoAliasMedico(destinatarios: string[] | undefined): string | null {
  for (const addr of destinatarios ?? []) {
    const m = /medico-([0-9a-f]{32})@/i.exec(addr);
    if (!m) continue;
    const h = m[1]!.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  return null;
}

export async function integracoesDe(userId: string): Promise<Integracoes> {
  const profile = await getProfile(userId).catch(() => null);
  return {
    whatsapp: whatsappConfigurado(),
    email_envio: getEmailConfigStatus().hasKey,
    email_entrada: aliasDoMedico(userId),
    super_admin: profile?.super_admin === true,
    btg: btgConfigurado(),
  };
}

export async function estadoCompleto(userId: string): Promise<EstadoMedico> {
  const [estado, integracoes] = await Promise.all([carregarEstado(userId), integracoesDe(userId)]);
  return { ...estado, integracoes };
}
