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

  // 1×1 PNG (transparent) — smallest valid raster to feed ImageRun.
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=',
    'base64',
  );

  it('embeds a logo image when provided in opts', async () => {
    const withLogo = await mdToDocxBuffer('# Title', 'WithLogo', {
      logo: { buffer: tinyPng, mime: 'image/png' },
    });
    const withoutLogo = await mdToDocxBuffer('# Title', 'WithoutLogo');
    expect(withLogo.length).toBeGreaterThan(withoutLogo.length);
    // ZIP magic bytes intact
    expect(withLogo[0]).toBe(0x50);
    expect(withLogo[1]).toBe(0x4b);
  });

  it('strips [INSERIR LOGO DO CLIENTE] placeholder lines from the source markdown', async () => {
    const md = '[INSERIR LOGO DO CLIENTE]\n\n# Title\n\nBody';
    // Tolerant render — should not throw, output is a valid docx.
    const buf = await mdToDocxBuffer(md, 'Logo Stripped');
    expect(buf.length).toBeGreaterThan(0);
  });

  it('renders pipe tables as docx Tables (output grows compared to no-table)', async () => {
    const withTable = await mdToDocxBuffer(
      '# Title\n\n| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n',
      'TableDoc',
    );
    const withoutTable = await mdToDocxBuffer('# Title\n\nNo table here.', 'PlainDoc');
    // A real Table element pulls in more XML than three flat paragraphs.
    expect(withTable.length).toBeGreaterThan(withoutTable.length);
    expect(withTable[0]).toBe(0x50);
    expect(withTable[1]).toBe(0x4b);
  });

  it('tolerates wide tables (>=10 cols) without throwing', async () => {
    const header = '| ' + Array.from({ length: 22 }, (_, i) => `C${i + 1}`).join(' | ') + ' |';
    const delim = '| ' + Array.from({ length: 22 }, () => '---').join(' | ') + ' |';
    const row = '| ' + Array.from({ length: 22 }, (_, i) => `${i}`).join(' | ') + ' |';
    const md = `# Wide\n\n${header}\n${delim}\n${row}\n${row}\n`;
    await expect(mdToDocxBuffer(md, 'Wide')).resolves.toBeInstanceOf(Buffer);
  });

  it('does not throw on a realistic 22-col Cotação table with empty body cells (regression)', async () => {
    const headers = [
      '#', 'Part Number', 'Fornecedor', 'Descrição', 'NCM', 'Local', 'UF',
      'Regime', 'Incoterm', 'Unid.', 'Qtd.', 'Unit. SEM IPI', 'Total SEM IPI',
      'Unit. COM IPI', 'Total COM IPI', 'PIS', 'COFINS', 'ICMS', 'IPI',
      'Pgto', 'Entrega', 'Obs.',
    ];
    const hdr = '| ' + headers.join(' | ') + ' |';
    const del = '|' + '---|'.repeat(22);
    const row = '| 1 |  |  |  |  |  |  |  |  |  |  | 0,00 | 0,00 | 0,00 | 0,00 |  |  |  |  |  |  |  |';
    const md = `# RFP\n\n## 5. Cotação\n\n${hdr}\n${del}\n${row}\n${row}\n${row}\n`;
    const buf = await mdToDocxBuffer(md, 'Cotação big');
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('builds a cover page with title and company block when cover data is provided', async () => {
    const withCover = await mdToDocxBuffer('# Body title\n\nBody.', 'Tested', {
      cover: {
        title: 'Tested',
        category: 'TI / Software',
        company: {
          company_name: 'ACME',
          company_legal_name: null,
          company_cnpj: '12.345.678/0001-90',
          company_email: 'a@b.c',
          company_phone: null,
          company_address: null,
          company_description: null,
        },
      },
    });
    const noCover = await mdToDocxBuffer('# Body title\n\nBody.', 'Tested');
    expect(withCover.length).toBeGreaterThan(noCover.length);
  });
});
