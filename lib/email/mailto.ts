// Sub-projeto — botão "Enviar para Outlook".
//
// Helpers puros pra montar `mailto:` href. Sem deps, fácil de testar.
// Cliente de email padrão do user resolve o resto (Outlook desktop, Outlook
// web, Gmail web, Apple Mail, Thunderbird — todos honram mailto:).

// Body cap conservador. RFC 2368 não define limite, mas clientes têm limites
// implícitos (Outlook ~2000, Gmail ~8000). 1800 deixa folga pro subject +
// scheme + encoding overhead (caracteres acentuados viram %XX-triplets).
export const MAX_BODY_CHARS = 1800;

const TRUNCATE_SUFFIX =
  '\r\n\r\n[Conteúdo truncado — baixe o .docx pra versão completa.]';

/**
 * Converte markdown em texto puro legível pra body de email. Não tenta
 * preservar formatação (cliente vai usar plain-text body); só remove os
 * marcadores que sujam a leitura.
 */
export function markdownToPlainText(md: string): string {
  let s = md;

  // Code fences ```...``` → conteúdo cru (remove só as cercas).
  s = s.replace(/```[a-zA-Z0-9_-]*\n?([\s\S]*?)```/g, (_, code) => code.trim());

  // Inline code `foo` → foo
  s = s.replace(/`([^`]+)`/g, '$1');

  // Links [texto](url) → "texto (url)". Imagens ![alt](url) → "alt (url)".
  s = s.replace(/!?\[([^\]]*)\]\(([^)]+)\)/g, (_, text, url) =>
    text ? `${text} (${url})` : url,
  );

  // Headings: remove os # do começo da linha (mantém o texto).
  s = s.replace(/^#{1,6}\s+/gm, '');

  // Bold **x** / __x__ → x
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/__([^_]+)__/g, '$1');

  // Italic *x* / _x_ → x. Cuidado pra não comer underscores de identificadores.
  s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, '$1');
  s = s.replace(/(?<![_\w])_([^_\n]+)_(?!\w)/g, '$1');

  // Tabelas: linha de separator (|---|---|) some, demais ficam tab-separated.
  s = s
    .split('\n')
    .filter((line) => !/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line))
    .map((line) => {
      if (/^\s*\|.*\|\s*$/.test(line)) {
        return line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
          .join('\t');
      }
      return line;
    })
    .join('\n');

  // HR (---, ***, ___) sozinha na linha → some.
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, '');

  // Colapsa 3+ newlines em 2.
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

/**
 * Trunca o body se passar de MAX_BODY_CHARS, anexa um suffix explicando.
 * Retorna `{ body, truncated }`.
 */
function truncate(body: string): { body: string; truncated: boolean } {
  if (body.length <= MAX_BODY_CHARS) return { body, truncated: false };
  const room = MAX_BODY_CHARS - TRUNCATE_SUFFIX.length;
  const cut = body.slice(0, Math.max(0, room)).trimEnd();
  return { body: cut + TRUNCATE_SUFFIX, truncated: true };
}

/**
 * Monta href `mailto:?subject=...&body=...` com encoding correto. Converte
 * `\n` em `\r\n` (Outlook desktop antigo só respeita CRLF) antes do encode.
 */
export function buildMailtoHref(args: { subject: string; body: string }): {
  href: string;
  truncated: boolean;
} {
  const { body: capped, truncated } = truncate(args.body);
  const bodyCrlf = capped.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  const subject = encodeURIComponent(args.subject);
  const body = encodeURIComponent(bodyCrlf);
  return { href: `mailto:?subject=${subject}&body=${body}`, truncated };
}
