import { randomBytes } from 'crypto';

import { configuredAppUrl } from '@/lib/app-url';
import { sendEmail } from '@/lib/email/client';
import { buildFluxoAndamentoEmail } from '@/lib/email/templates';
import type { FluxoProcesso } from './types';

// Avisos por e-mail do Fluxo de Compras (sub-projeto 90). Tudo fail-soft:
// e-mail que não sai nunca derruba a decisão que o disparou.
//
// Fica separado de acompanhamento.ts de propósito: process.ts importa este
// arquivo (aviso a cada SIGA) e acompanhamento.ts importa process.ts
// (aprovação do gestor chama decidirEtapa). Juntos, seria import circular.

/** 32 bytes aleatórios: mesmo padrão dos convites de licença. */
export function novoTokenFluxo(): string {
  return randomBytes(32).toString('base64url');
}

export function linkAcompanhamento(token: string): string {
  return `${configuredAppUrl()}/acompanhar/${token}`;
}

export function linkAprovacao(token: string): string {
  return `${configuredAppUrl()}/aprovar/${token}`;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Envia ao solicitante o link (primeiro envio) ou o aviso de etapa concluída. */
export async function notificarSolicitante(args: {
  processo: FluxoProcesso;
  etapaConcluida?: string | null;
  proximaEtapa?: string | null;
  concluido?: boolean;
}): Promise<boolean> {
  const { processo } = args;
  const email = processo.solicitante_email?.trim();
  const token = processo.acompanhamento_token;
  if (!email || !token || !emailValido(email)) return false;

  try {
    const { subject, html } = buildFluxoAndamentoEmail({
      solicitanteNome: processo.solicitante_nome ?? '',
      tituloCompra: processo.titulo,
      link: linkAcompanhamento(token),
      etapaConcluida: args.etapaConcluida ?? null,
      proximaEtapa: args.proximaEtapa ?? null,
      concluido: args.concluido ?? false,
    });
    const r = await sendEmail({ to: email, subject, html });
    return r.ok;
  } catch (err) {
    console.warn('[fluxo] aviso ao solicitante falhou:', err);
    return false;
  }
}
