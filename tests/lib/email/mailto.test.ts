import { describe, expect, it } from 'vitest';
import {
  markdownToPlainText,
  buildMailtoHref,
  MAX_BODY_CHARS,
} from '@/lib/email/mailto';

describe('markdownToPlainText', () => {
  it('strips headings', () => {
    const md = '# Título\n\nConteúdo\n\n## Sub\n\nMais';
    expect(markdownToPlainText(md)).toBe('Título\n\nConteúdo\n\nSub\n\nMais');
  });

  it('strips bold/italic/inline code', () => {
    const md = 'Texto **forte** e *enfase* com `código`';
    expect(markdownToPlainText(md)).toBe('Texto forte e enfase com código');
  });

  it('rewrites links as "texto (url)"', () => {
    const md = 'Ver [docs](https://example.com/x) agora';
    expect(markdownToPlainText(md)).toBe('Ver docs (https://example.com/x) agora');
  });

  it('flattens tables to tab-separated rows and drops separator', () => {
    const md = '| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |';
    expect(markdownToPlainText(md)).toBe('A\tB\n1\t2\n3\t4');
  });

  it('removes code fences but keeps content', () => {
    const md = '```ts\nconst x = 1;\n```';
    expect(markdownToPlainText(md)).toBe('const x = 1;');
  });

  it('collapses 3+ blank lines into 2', () => {
    const md = 'a\n\n\n\nb';
    expect(markdownToPlainText(md)).toBe('a\n\nb');
  });

  it('preserves list markers', () => {
    const md = '- item 1\n- item 2\n\n1. primeiro\n2. segundo';
    expect(markdownToPlainText(md)).toBe(
      '- item 1\n- item 2\n\n1. primeiro\n2. segundo',
    );
  });
});

describe('buildMailtoHref', () => {
  it('encodes subject and body in URL', () => {
    const { href, truncated } = buildMailtoHref({
      subject: 'RFP — Cadeiras',
      body: 'Olá, segue.',
    });
    expect(truncated).toBe(false);
    expect(href).toMatch(/^mailto:\?subject=/);
    expect(href).toContain('RFP%20%E2%80%94%20Cadeiras');
    expect(href).toContain('Ol%C3%A1');
  });

  it('converts \\n to \\r\\n in body before encoding', () => {
    const { href } = buildMailtoHref({ subject: 's', body: 'a\nb' });
    // \r\n encoded → %0D%0A
    expect(href).toContain('%0D%0A');
    expect(href).not.toMatch(/[^D]%0A/); // standalone %0A não deve aparecer
  });

  it('encodes ampersand and question mark safely', () => {
    const { href } = buildMailtoHref({
      subject: 'Q & A?',
      body: 'foo & bar?',
    });
    expect(href).toContain('Q%20%26%20A%3F');
    expect(href).toContain('foo%20%26%20bar%3F');
  });

  it('truncates body when exceeding MAX_BODY_CHARS', () => {
    const huge = 'x'.repeat(MAX_BODY_CHARS + 500);
    const { href, truncated } = buildMailtoHref({ subject: 's', body: huge });
    expect(truncated).toBe(true);
    expect(href).toContain('truncado');
  });

  it('does not truncate when body is at limit', () => {
    const exact = 'x'.repeat(MAX_BODY_CHARS);
    const { truncated } = buildMailtoHref({ subject: 's', body: exact });
    expect(truncated).toBe(false);
  });
});
