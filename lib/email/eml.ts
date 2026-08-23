// Construtor de arquivo .eml (RFC 5322 + MIME) — backlog do diretor
// (2026-08-19, ver docs/product/backlog-diretor-2026-08-19.md, Batch I).
//
// POR QUE existe: o pedido era "um campo onde o comprador aperte e abra o
// e-mail dele com o arquivo já anexado". `mailto:` NÃO anexa arquivo (e corta
// o corpo em ~1800 chars — ver lib/email/mailto.ts). Um .eml baixado abre no
// Outlook/Thunderbird/Apple Mail COM o anexo dentro, pronto pra revisar e
// enviar — e continua saindo da conta do próprio comprador, não da nossa.
//
// O header `X-Unsent: 1` é o que faz o Outlook abrir como RASCUNHO editável
// em vez de mensagem recebida (sem ele, não há botão Enviar). Apple Mail e
// Thunderbird ignoram o header e abrem como mensagem — o comprador usa
// "Encaminhar", que preserva o anexo.
//
// Módulo puro: sem I/O, sem env, sem deps. Fácil de testar byte a byte.

const CRLF = '\r\n';
const MAX_LINE = 76;

export type EmlAttachment = {
  filename: string;
  contentType: string;
  content: Buffer;
};

export type EmlInput = {
  to?: string[];
  subject: string;
  bodyText: string;
  attachments?: EmlAttachment[];
  /** Data da mensagem. Injetável para deixar o output determinístico em teste. */
  date?: Date;
  /** Boundary MIME. Injetável pelo mesmo motivo. */
  boundary?: string;
};

/** Só ASCII imprimível? Decide se o header precisa de encoded-word. */
function isAscii(s: string): boolean {
  // eslint-disable-next-line no-control-regex
  return !/[^\x20-\x7E]/.test(s);
}

/**
 * RFC 2047 encoded-word para headers com acento. Quebra em pedaços porque
 * cada encoded-word tem limite de 75 chars — "Cotação de serviços de
 * logística" cabe num só, mas um assunto longo não.
 */
export function encodeHeaderValue(value: string): string {
  const collapsed = value.replace(/[\r\n]+/g, ' ').trim();
  if (isAscii(collapsed)) return collapsed;

  const bytes = Buffer.from(collapsed, 'utf8');
  const words: string[] = [];
  // 45 bytes de origem → 60 chars de base64 + 12 de moldura = 72 < 75.
  const CHUNK = 45;
  let start = 0;
  while (start < bytes.length) {
    // Não corta no meio de um caractere multibyte: recua até um byte inicial.
    let end = Math.min(start + CHUNK, bytes.length);
    while (end > start + 1 && end < bytes.length && (bytes[end]! & 0b1100_0000) === 0b1000_0000) {
      end--;
    }
    words.push(`=?UTF-8?B?${bytes.subarray(start, end).toString('base64')}?=`);
    start = end;
  }
  return words.join(`${CRLF} `);
}

/**
 * Quoted-printable (RFC 2045 §6.7). Preserva o texto legível em clientes que
 * não decodificam, sem estourar o limite de 76 colunas nem perder acento.
 */
export function toQuotedPrintable(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const out: string[] = [];

  for (const rawLine of normalized.split('\n')) {
    let line = '';
    const flush = (soft: boolean) => {
      out.push(soft ? `${line}=` : line);
      line = '';
    };
    const bytes = Buffer.from(rawLine, 'utf8');
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i]!;
      const isLast = i === bytes.length - 1;
      let token: string;
      if (b === 0x3d) {
        token = '=3D';
      } else if (b === 0x09 || b === 0x20) {
        // Espaço/tab no fim da linha PRECISA ser codificado, senão o
        // transporte pode comê-lo.
        token = isLast ? (b === 0x09 ? '=09' : '=20') : String.fromCharCode(b);
      } else if (b >= 0x21 && b <= 0x7e) {
        token = String.fromCharCode(b);
      } else {
        token = `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
      }
      // -1 pelo '=' do soft break.
      if (line.length + token.length > MAX_LINE - 1) flush(true);
      line += token;
    }
    flush(false);
  }
  return out.join(CRLF);
}

/** Base64 quebrado em linhas de 76 colunas, como exige o MIME. */
function base64Lines(buf: Buffer): string {
  const b64 = buf.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += MAX_LINE) {
    lines.push(b64.slice(i, i + MAX_LINE));
  }
  return lines.join(CRLF);
}

/**
 * Nome de arquivo em Content-Disposition. Mantém a forma ASCII para clientes
 * antigos e acrescenta `filename*` (RFC 2231) quando há acento.
 */
function dispositionFilename(filename: string): string {
  const safe = filename.replace(/["\\]/g, '').replace(/[^\x20-\x7E]/g, '_');
  let out = `filename="${safe}"`;
  if (!isAscii(filename)) {
    out += `;${CRLF} filename*=UTF-8''${encodeURIComponent(filename)}`;
  }
  return out;
}

/** Data no formato RFC 5322 (ex.: "Fri, 22 Aug 2026 09:41:00 +0000"). */
function rfc5322Date(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${days[d.getUTCDay()]}, ${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ` +
    `${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:` +
    `${p(d.getUTCSeconds())} +0000`
  );
}

/**
 * Monta a mensagem completa. Sem anexo, sai `text/plain` puro; com anexo,
 * `multipart/mixed`. Sempre CRLF — cliente de e-mail é intolerante a LF só.
 */
export function buildEml(input: EmlInput): string {
  const attachments = (input.attachments ?? []).filter((a) => a.content.length > 0);
  const to = (input.to ?? []).map((t) => t.trim()).filter(Boolean);
  const boundary =
    input.boundary ??
    `----progpt-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  const headers: string[] = [
    'MIME-Version: 1.0',
    // Faz o Outlook abrir como rascunho editável em vez de item recebido.
    'X-Unsent: 1',
    `Date: ${rfc5322Date(input.date ?? new Date())}`,
  ];
  if (to.length > 0) headers.push(`To: ${to.join(', ')}`);
  headers.push(`Subject: ${encodeHeaderValue(input.subject)}`);

  const bodyPart = [
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: quoted-printable',
    '',
    toQuotedPrintable(input.bodyText),
  ].join(CRLF);

  if (attachments.length === 0) {
    return [...headers, bodyPart, ''].join(CRLF);
  }

  const parts: string[] = [
    `--${boundary}`,
    bodyPart,
  ];
  for (const a of attachments) {
    parts.push(
      `--${boundary}`,
      `Content-Type: ${a.contentType}; name="${a.filename.replace(/["\\]/g, '')}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; ${dispositionFilename(a.filename)}`,
      '',
      base64Lines(a.content),
    );
  }
  parts.push(`--${boundary}--`, '');

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    ...parts,
  ].join(CRLF);
}
