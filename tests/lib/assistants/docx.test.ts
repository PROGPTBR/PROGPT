import { describe, expect, it } from 'vitest';
import { mdToDocxBuffer } from '@/lib/assistants/docx';

describe('mdToDocxBuffer', () => {
  it('returns a Buffer with the docx magic bytes (PK ZIP signature)', async () => {
    const buf = await mdToDocxBuffer('# Hello\n\nworld', 'Test');
    // docx files are ZIP archives — start with 0x50 0x4B (PK).
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('tolerates empty markdown without throwing', async () => {
    await expect(mdToDocxBuffer('', 'Empty')).resolves.toBeInstanceOf(Buffer);
  });

  it('tolerates markdown with tables (flattens to text without throwing)', async () => {
    const md = `## Cronograma

| Etapa | Prazo |
|-------|-------|
| Q&A | 5 dias |
| Submissão | 10 dias |

Continuação após tabela.`;
    await expect(mdToDocxBuffer(md, 'Tabela teste')).resolves.toBeInstanceOf(Buffer);
  });

  it('tolerates stray ** runs without throwing', async () => {
    const md = '# Título\n\nIsso tem **bold parcial sem fechar e continua...';
    await expect(mdToDocxBuffer(md, 'Malformed')).resolves.toBeInstanceOf(Buffer);
  });

  it('handles long input (full RFP-size document)', async () => {
    const sections = Array.from(
      { length: 30 },
      (_, i) => `## Seção ${i + 1}\n\nParágrafo de exemplo com **bold** e listas.\n\n- item a\n- item b\n`,
    );
    const md = `# RFP Grande\n\n${sections.join('\n')}`;
    const buf = await mdToDocxBuffer(md, 'Big RFP');
    expect(buf.length).toBeGreaterThan(1000); // não-trivial
  });

  it('renders headings, bullets, and ordered lists (smoke — buffer size grows with content)', async () => {
    const empty = await mdToDocxBuffer('', 'Empty');
    const rich = await mdToDocxBuffer(
      '# H1\n\n## H2\n\n- bullet a\n- bullet b\n\n1. one\n2. two\n\n**bold** word',
      'Rich',
    );
    expect(rich.length).toBeGreaterThan(empty.length);
  });
});
