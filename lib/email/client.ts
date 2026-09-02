import nodemailer from 'nodemailer';
import { configuredAppUrl } from '@/lib/app-url';

// Wrapper de envio via SMTP (Hostgator/Titan) — substitui o Resend
// (2026-09-02): a caixa comercial@2bsupply.com.br já existe e é
// administrada pelo time, então não faz sentido manter uma segunda fonte
// de envio de e-mail transacional pro mesmo domínio.
//
// Fail-soft: email transacional NUNCA quebra fluxo principal (signup,
// webhook, cancel). Erros são logados e engolidos. Pattern espelha
// `recordApiUsage` (sub-projeto 19).
//
// Env vars:
//   SMTP_HOST      — ex.: smtp.titan.email
//   SMTP_PORT      — ex.: 587 (STARTTLS) ou 465 (TLS implícito). Default 587.
//   SMTP_USER      — caixa autenticada, ex.: comercial@2bsupply.com.br
//   SMTP_PASSWORD  — senha da caixa
//   EMAIL_FROM     — sender exibido. Default: 'PROGPT <SMTP_USER>' — a
//                    maioria dos provedores SMTP (Titan incluso) rejeita ou
//                    marca spam quando o From não bate com a caixa
//                    autenticada, então o default usa a própria caixa.
//   APP_URL        — usado pra construir links em templates. O domínio
//                    desativado é rejeitado e cai no domínio canônico.

const FALLBACK_FROM = 'PROGPT <comercial@2bsupply.com.br>';
let _transporter: nodemailer.Transporter | null = null;

function smtpUser(): string | undefined {
  return process.env.SMTP_USER || undefined;
}

function defaultFrom(): string {
  const user = smtpUser();
  return user ? `PROGPT <${user}>` : FALLBACK_FROM;
}

// Diagnóstico da config estática (sem abrir conexão SMTP) — usado por
// /api/admin/email-health e por qualquer envio que precise explicar UM
// "falhou" pro admin em vez de um 502 mudo. `isSandboxFrom` (nome mantido
// por compat com callers existentes) sinaliza o gotcha real do SMTP: From
// que não bate com a caixa autenticada — muitos provedores (Titan
// incluso) rejeitam ou jogam pra spam nesse caso.
export function getEmailConfigStatus(): {
  hasKey: boolean;
  from: string;
  isSandboxFrom: boolean;
} {
  const hasKey = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
  const from = process.env.EMAIL_FROM ?? defaultFrom();
  const user = smtpUser();
  const isSandboxFrom = !!user && !from.includes(user);
  return { hasKey, from, isSandboxFrom };
}

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? 587);
  _transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  return _transporter;
}

export function getAppUrl(): string {
  return configuredAppUrl();
}

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  /**
   * Reservado por compat com callers existentes (o Resend deduplicava por
   * 24h via esse campo). SMTP não tem dedupe embutido — os callers já têm
   * proteção própria contra double-send (billing_webhook_events dedup por
   * evento; welcome usa lock em profiles.welcome_email_sent_at). Ignorado
   * aqui de propósito.
   */
  idempotencyKey?: string;
};

/**
 * Envia email transacional via SMTP. Fail-soft: retorna `{ ok: false }` em
 * qualquer erro (env missing, SMTP 4xx/5xx, exception) sem propagar.
 * Caller deve sempre checar mas nunca abortar fluxo principal por causa de
 * email.
 */
export async function sendEmail(
  input: EmailInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[email] SMTP não configurado — email skipped:', input.subject);
    return { ok: false, error: 'SMTP_HOST/SMTP_USER/SMTP_PASSWORD ausente' };
  }
  const from = process.env.EMAIL_FROM ?? defaultFrom();
  try {
    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });
    return { ok: true, id: info.messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[email] sendEmail swallowed:', msg);
    return { ok: false, error: msg };
  }
}
