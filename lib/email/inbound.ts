import crypto from 'node:crypto';

// Resend Inbound — verificação de assinatura (Svix) + busca de corpo/anexos.
//
// O webhook do Resend (`email.received`) traz só metadados; corpo e anexos são
// buscados depois via API. A verificação usa o padrão Svix (headers
// svix-id/svix-timestamp/svix-signature + RESEND_WEBHOOK_SECRET `whsec_…`).

/** Domínio de inbound configurado (ex.: "abc123.resend.app" ou um custom). */
export function inboundDomain(): string | null {
  return process.env.RESEND_INBOUND_DOMAIN?.trim() || null;
}

/** Alias dedicado por usuário (mapeia o e-mail recebido → usuário). */
export function generateInboundAlias(domain: string): string {
  const token = crypto.randomBytes(5).toString('hex'); // 10 hex chars
  return `cotacoes-${token}@${domain}`;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Verifica a assinatura Svix de um webhook do Resend. Retorna true só se a
 * assinatura confere e o timestamp está dentro da tolerância (anti-replay).
 */
export function verifyResendSignature(opts: {
  payload: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret: string;
  toleranceSecs?: number;
  nowSecs?: number;
}): boolean {
  const { payload, svixId, svixTimestamp, svixSignature, secret } = opts;
  if (!svixId || !svixTimestamp || !svixSignature || !secret) return false;

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = opts.nowSecs ?? Math.floor(Date.now() / 1000);
  const tol = opts.toleranceSecs ?? 300;
  if (Math.abs(now - ts) > tol) return false;

  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  } catch {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64');

  // svix-signature pode trazer várias "v1,<sig>" separadas por espaço.
  const provided = svixSignature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter((s): s is string => !!s);

  return provided.some((sig) => timingSafeEqual(sig, expected));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Busca o corpo (texto) do e-mail recebido via API do Resend. Best-effort:
 * retorna '' em qualquer erro. (Confirmar o endpoint exato no 1º e-mail real.)
 */
export async function fetchReceivedEmailText(emailId: string): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { text?: string; html?: string };
    if (data.text && data.text.trim()) return data.text.trim();
    if (data.html) return stripHtml(data.html);
    return '';
  } catch {
    return '';
  }
}

type InboundAttachmentMeta = { id: string; filename?: string; content_type?: string };

/**
 * Baixa e extrai texto dos anexos do e-mail recebido (PDF/DOCX/XLSX/imagem),
 * via API de anexos do Resend + o parser de attachments do chat. Best-effort.
 */
export async function fetchInboundAttachmentsText(
  emailId: string,
  attachments: InboundAttachmentMeta[],
): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key || attachments.length === 0) return '';

  const { parseChatAttachment } = await import('@/lib/chat-attachments');
  const parts: string[] = [];

  for (const att of attachments.slice(0, 8)) {
    try {
      const metaRes = await fetch(
        `https://api.resend.com/emails/${emailId}/attachments/${att.id}`,
        { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) },
      );
      if (!metaRes.ok) continue;
      const meta = (await metaRes.json()) as { download_url?: string; content?: string };

      let buf: Buffer | null = null;
      if (meta.content) {
        buf = Buffer.from(meta.content, 'base64');
      } else if (meta.download_url) {
        const dl = await fetch(meta.download_url, { signal: AbortSignal.timeout(20000) });
        if (dl.ok) buf = Buffer.from(await dl.arrayBuffer());
      }
      if (!buf) continue;

      const parsed = await parseChatAttachment({
        buf,
        mime: att.content_type ?? 'application/octet-stream',
        filename: att.filename ?? 'anexo',
      });
      if (parsed.parsedText.trim()) {
        parts.push(`--- ${att.filename ?? 'anexo'} ---\n${parsed.parsedText.trim()}`);
      }
    } catch {
      /* ignora anexo que falhar */
    }
  }
  return parts.join('\n\n');
}
