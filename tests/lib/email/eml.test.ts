import { describe, expect, it } from 'vitest';
import {
  buildEml,
  encodeHeaderValue,
  toQuotedPrintable,
} from '@/lib/email/eml';

// Backlog do diretor (2026-08-19, Batch I) — o .eml é lido por Outlook /
// Thunderbird / Apple Mail, que são intolerantes a desvio de formato. Os
// testes travam as regras que quebram o arquivo na prática: CRLF, limite de
// 76 colunas, encoded-word em header com acento e base64 do anexo.

const FIXED_DATE = new Date('2026-08-22T12:34:56Z');
const BOUNDARY = 'test-boundary';

function build(overrides: Partial<Parameters<typeof buildEml>[0]> = {}) {
  return buildEml({
    subject: 'RFQ',
    bodyText: 'Prezados,',
    date: FIXED_DATE,
    boundary: BOUNDARY,
    ...overrides,
  });
}

describe('encodeHeaderValue', () => {
  it('leaves pure-ASCII headers untouched', () => {
    expect(encodeHeaderValue('RFQ - Embalagens 2026')).toBe(
      'RFQ - Embalagens 2026',
    );
  });

  it('wraps accented headers in an RFC 2047 encoded-word', () => {
    const out = encodeHeaderValue('Cotação de serviços');
    expect(out).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    const b64 = out.slice('=?UTF-8?B?'.length, -'?='.length);
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(
      'Cotação de serviços',
    );
  });

  it('splits long accented headers into multiple encoded-words, each ≤ 75 chars', () => {
    const long = 'Cotação de embalagens flexíveis laminadas '.repeat(4);
    const out = encodeHeaderValue(long);
    const words = out.split('\r\n ');
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) expect(w.length).toBeLessThanOrEqual(75);
    // Round-trip: concatenar os pedaços decodificados devolve o original.
    const decoded = words
      .map((w) =>
        Buffer.from(w.slice('=?UTF-8?B?'.length, -'?='.length), 'base64'),
      )
      .reduce((a, b) => Buffer.concat([a, b]));
    expect(decoded.toString('utf8')).toBe(long.trim());
  });

  it('collapses newlines so a header cannot be injected', () => {
    const out = encodeHeaderValue('RFQ\r\nBcc: attacker@example.com');
    expect(out).not.toContain('\r');
    expect(out).not.toContain('\n');
  });
});

describe('toQuotedPrintable', () => {
  it('encodes non-ASCII bytes and the literal "="', () => {
    expect(toQuotedPrintable('preço = 10')).toBe('pre=C3=A7o =3D 10');
  });

  it('keeps lines within 76 columns using soft breaks', () => {
    const out = toQuotedPrintable('a'.repeat(200));
    const lines = out.split('\r\n');
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(76);
    expect(lines.slice(0, -1).every((l) => l.endsWith('='))).toBe(true);
    // Removendo os soft breaks, o texto original volta inteiro.
    expect(out.replace(/=\r\n/g, '')).toBe('a'.repeat(200));
  });

  it('encodes trailing whitespace so the transport cannot eat it', () => {
    expect(toQuotedPrintable('fim ')).toBe('fim=20');
  });

  it('normalizes LF and CRLF to CRLF line breaks', () => {
    expect(toQuotedPrintable('a\nb')).toBe('a\r\nb');
    expect(toQuotedPrintable('a\r\nb')).toBe('a\r\nb');
  });
});

describe('buildEml', () => {
  it('emits text/plain (no multipart) when there is no attachment', () => {
    const eml = build();
    expect(eml).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(eml).not.toContain('multipart/mixed');
  });

  it('marks the message as unsent so Outlook opens it as an editable draft', () => {
    expect(build()).toContain('X-Unsent: 1');
  });

  it('uses CRLF everywhere', () => {
    const eml = build({ bodyText: 'linha 1\nlinha 2' });
    expect(eml.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('writes an RFC 5322 Date header', () => {
    expect(build()).toContain('Date: Sat, 22 Aug 2026 12:34:56 +0000');
  });

  it('omits the To header when no recipient was given, and joins them when given', () => {
    expect(build()).not.toContain('To:');
    expect(build({ to: ['a@x.com', 'b@y.com'] })).toContain(
      'To: a@x.com, b@y.com',
    );
  });

  it('embeds the attachment as base64 in a multipart/mixed body', () => {
    const content = Buffer.from('conteúdo do docx', 'utf8');
    const eml = build({
      attachments: [
        { filename: 'rfp-1234.docx', contentType: 'application/x-test', content },
      ],
    });

    expect(eml).toContain(`Content-Type: multipart/mixed; boundary="${BOUNDARY}"`);
    expect(eml).toContain('Content-Type: application/x-test; name="rfp-1234.docx"');
    expect(eml).toContain('Content-Transfer-Encoding: base64');
    expect(eml).toContain('Content-Disposition: attachment; filename="rfp-1234.docx"');
    expect(eml).toContain(content.toString('base64'));
    expect(eml.trimEnd().endsWith(`--${BOUNDARY}--`)).toBe(true);
  });

  it('breaks the attachment base64 into lines of at most 76 chars', () => {
    const eml = build({
      attachments: [
        {
          filename: 'big.bin',
          contentType: 'application/octet-stream',
          content: Buffer.alloc(1000, 7),
        },
      ],
    });
    for (const line of eml.split('\r\n')) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it('adds RFC 2231 filename* when the attachment name has accents', () => {
    const eml = build({
      attachments: [
        {
          filename: 'cotação.docx',
          contentType: 'application/x-test',
          content: Buffer.from('x'),
        },
      ],
    });
    expect(eml).toContain('filename="cota__o.docx"'); // fallback ASCII
    expect(eml).toContain("filename*=UTF-8''cota%C3%A7%C3%A3o.docx");
  });

  it('drops empty attachments instead of emitting an empty MIME part', () => {
    const eml = build({
      attachments: [
        { filename: 'vazio.docx', contentType: 'application/x-test', content: Buffer.alloc(0) },
      ],
    });
    expect(eml).not.toContain('multipart/mixed');
    expect(eml).not.toContain('vazio.docx');
  });
});
