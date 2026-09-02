import { Resend } from 'resend';
import { configuredAppUrl } from '@/lib/app-url';

// Sub-projeto 30 — wrapper do Resend.
//
// Fail-soft: email transacional NUNCA quebra fluxo principal (signup,
// webhook, cancel). Erros são logados e engolidos. Pattern espelha
// `recordApiUsage` (sub-projeto 19).
//
// Env vars:
//   RESEND_API_KEY — token gerado em resend.com → API Keys
//   EMAIL_FROM     — sender. Default: 'PROGPT <onboarding@resend.dev>'
//                    (resend.dev funciona sem DNS setup — use enquanto
//                    SPF/DKIM do 2bsupply.com.br não tá pronto).
//                    Prod: 'PROGPT <noreply@2bsupply.com.br>'
//   APP_URL        — usado pra construir links em templates. O domínio
//                    desativado é rejeitado e cai no domínio canônico.

const DEFAULT_FROM = 'PROGPT <onboarding@resend.dev>';
let _client: Resend | null = null;

// Diagnóstico da config estática (sem chamar a API) — usado por
// /api/admin/email-health e por qualquer envio que precise explicar UM
// "falhou" pro admin em vez de um 502 mudo. isSandboxFrom sinaliza o caso
// mais comum: EMAIL_FROM ainda no domínio sandbox do Resend, que só
// entrega pro dono da conta — nunca pra um cliente real, mesmo com a API
// respondendo 200.
export function getEmailConfigStatus(): {
  hasKey: boolean;
  from: string;
  isSandboxFrom: boolean;
} {
  const hasKey = !!process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  const isSandboxFrom = from === DEFAULT_FROM || from.includes('@resend.dev');
  return { hasKey, from, isSandboxFrom };
}

function getClient(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}

export function getAppUrl(): string {
  return configuredAppUrl();
}

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  /**
   * Idempotency key (string única por (user, event)). Resend rejeita
   * duplicate `idempotency_key` em 24h, evitando double-send se webhook
   * Asaas dispara mesmo evento 2x.
   */
  idempotencyKey?: string;
};

/**
 * Envia email transacional. Fail-soft: retorna `{ ok: false }` em qualquer
 * erro (env missing, Resend 5xx, exception) sem propagar. Caller deve
 * sempre checar mas nunca abortar fluxo principal por causa de email.
 */
export async function sendEmail(
  input: EmailInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY missing — email skipped:', input.subject);
    return { ok: false, error: 'RESEND_API_KEY ausente' };
  }
  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  try {
    const { data, error } = await client.emails.send(
      {
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
      },
      input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
    );
    if (error) {
      console.warn('[email] Resend error:', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[email] sendEmail swallowed:', msg);
    return { ok: false, error: msg };
  }
}
