import { Resend } from 'resend';

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
//   APP_URL        — usado pra construir links em templates. Default:
//                    https://progpt-production.up.railway.app

const DEFAULT_FROM = 'PROGPT <onboarding@resend.dev>';
const DEFAULT_APP_URL = 'https://progpt-production.up.railway.app';

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _client = new Resend(key);
  return _client;
}

export function getAppUrl(): string {
  return process.env.APP_URL ?? DEFAULT_APP_URL;
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
export async function sendEmail(input: EmailInput): Promise<{ ok: boolean; id?: string }> {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY missing — email skipped:', input.subject);
    return { ok: false };
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
      return { ok: false };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[email] sendEmail swallowed:', msg);
    return { ok: false };
  }
}
