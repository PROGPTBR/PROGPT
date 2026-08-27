import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockParsers(opts: {
  parseSourceText?: string;
  parseSourceBlocks?: Array<
    | { type: 'text'; content: string }
    | { type: 'table'; markdown: string; caption?: string }
    | { type: 'figure'; description: string; caption?: string }
  >;
  parseSourceThrows?: Error;
  xlsx?: string;
  visionText?: string | null;
  // Fallback de invoice (só relevante quando parseSourceThrows é setado
  // pra PDF) — undefined = extractInvoiceFromPdf nunca é chamado no teste.
  invoiceFields?: Record<string, unknown>;
  invoiceThrows?: Error;
}) {
  const parseSource = vi.fn().mockImplementation(async () => {
    if (opts.parseSourceThrows) throw opts.parseSourceThrows;
    if (opts.parseSourceBlocks) {
      return {
        parsed: { kind: 'blocks', blocks: opts.parseSourceBlocks },
        parser: 'multimodal',
      };
    }
    return {
      parsed: { kind: 'text', text: opts.parseSourceText ?? 'parsed text' },
      parser: 'text-only',
    };
  });
  vi.doMock('@/lib/ingest/parse-source', () => ({ parseSource }));

  const parseXlsxToMarkdown = vi
    .fn()
    .mockImplementation(async () => opts.xlsx ?? '# Sheet\n\n| a |');
  vi.doMock('@/lib/chat-attachments/xlsx', () => ({ parseXlsxToMarkdown }));

  const describeImageWithVision = vi
    .fn()
    .mockImplementation(async () =>
      opts.visionText === null ? null : (opts.visionText ?? 'image desc'),
    );
  vi.doMock('@/lib/chat-attachments/image', () => ({
    describeImageWithVision,
  }));

  const extractInvoiceFromPdf = vi.fn().mockImplementation(async () => {
    if (opts.invoiceThrows) throw opts.invoiceThrows;
    return opts.invoiceFields ?? {};
  });
  vi.doMock('@/lib/spend/invoice-extract', () => ({ extractInvoiceFromPdf }));

  vi.doMock('@/lib/observability/api-usage', () => ({
    recordApiUsage: vi.fn(),
  }));

  return { parseSource, parseXlsxToMarkdown, describeImageWithVision, extractInvoiceFromPdf };
}

describe('parseChatAttachment dispatcher', () => {
  it('routes PDFs to parseSource and returns kind=pdf', async () => {
    const m = mockParsers({ parseSourceText: 'PDF body' });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('fake pdf'),
      mime: 'application/pdf',
      filename: 'doc.pdf',
    });
    expect(out.kind).toBe('pdf');
    expect(out.parsedText).toBe('PDF body');
    expect(out.truncated).toBe(false);
    expect(m.parseSource).toHaveBeenCalledOnce();
  });

  it('flattens blocks into text for PDFs that came back as multimodal output', async () => {
    mockParsers({
      parseSourceBlocks: [
        { type: 'text', content: 'first para' },
        { type: 'table', markdown: '| a |\n| --- |\n| 1 |', caption: 'Tbl' },
        { type: 'figure', description: 'a chart', caption: 'Fig 1' },
      ],
    });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('x'),
      mime: 'application/pdf',
      filename: 'doc.pdf',
    });
    expect(out.parsedText).toContain('first para');
    expect(out.parsedText).toContain('| a |');
    expect(out.parsedText).toContain('a chart');
    expect(out.parsedText).toContain('Tbl');
  });

  it('falls back to invoice extraction when the generic PDF parser fails entirely (scanned nota fiscal case)', async () => {
    const m = mockParsers({
      parseSourceThrows: new Error(
        'Conteúdo muito curto — PDF parece escaneado / OCR necessário (texto extraído < 500 caracteres) | Multimodal também falhou: multimodal parse produced no usable blocks after repair',
      ),
      invoiceFields: {
        supplier: 'ACME Ltda',
        invoiceNumber: '12345',
        total: 4500.9,
        currency: 'BRL',
        invoiceDate: '2026-08-20',
        ocrUsed: true,
      },
    });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('fake scanned pdf'),
      mime: 'application/pdf',
      filename: 'nota.pdf',
    });
    expect(out.parser).toBe('invoice-fallback');
    expect(out.parsedText).toContain('ACME Ltda');
    expect(out.parsedText).toContain('12345');
    expect(out.parsedText).toContain('4500.9');
    expect(out.parsedText).toContain('escaneado/fotografado');
    expect(out.parsedText).toContain('Simulador Logístico (DIFAL)');
    expect(m.extractInvoiceFromPdf).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'nota.pdf', operation: 'chat-attachment-parse' }),
    );
  });

  it('throws a combined error when both the generic parser AND the invoice fallback fail', async () => {
    mockParsers({
      parseSourceThrows: new Error('generic parse failed'),
      invoiceThrows: new Error('PDF muito pequeno ou vazio — verifique o arquivo.'),
    });
    const { parseChatAttachment, AttachmentParseError } = await import('@/lib/chat-attachments');
    await expect(
      parseChatAttachment({ buf: Buffer.from('x'), mime: 'application/pdf', filename: 'x.pdf' }),
    ).rejects.toBeInstanceOf(AttachmentParseError);
    await expect(
      parseChatAttachment({ buf: Buffer.from('x'), mime: 'application/pdf', filename: 'x.pdf' }),
    ).rejects.toThrow(/generic parse failed.*Extração de nota fiscal também falhou.*muito pequeno/s);
  });

  it('treats an invoice extraction with no usable field as a failure (not a false success)', async () => {
    mockParsers({
      parseSourceThrows: new Error('generic parse failed'),
      invoiceFields: { poNumber: 'Sem PO', paymentTerms: 'Não informado' },
    });
    const { parseChatAttachment, AttachmentParseError } = await import('@/lib/chat-attachments');
    await expect(
      parseChatAttachment({ buf: Buffer.from('x'), mime: 'application/pdf', filename: 'x.pdf' }),
    ).rejects.toBeInstanceOf(AttachmentParseError);
  });

  it('routes DOCX through parseSource with kind=docx', async () => {
    mockParsers({ parseSourceText: 'docx text' });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('x'),
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filename: 'doc.docx',
    });
    expect(out.kind).toBe('docx');
    expect(out.parsedText).toBe('docx text');
  });

  it('routes XLSX to parseXlsxToMarkdown', async () => {
    const m = mockParsers({ xlsx: '# Sheet1\n\n| col |' });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('x'),
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: 'data.xlsx',
    });
    expect(out.kind).toBe('xlsx');
    expect(out.parser).toBe('exceljs');
    expect(m.parseXlsxToMarkdown).toHaveBeenCalledOnce();
  });

  it('routes images through describeImageWithVision', async () => {
    const m = mockParsers({ visionText: 'a screenshot of a table' });
    const { parseChatAttachment } = await import('@/lib/chat-attachments');
    const out = await parseChatAttachment({
      buf: Buffer.from('x'),
      mime: 'image/png',
      filename: 'print.png',
    });
    expect(out.kind).toBe('image');
    expect(out.parser).toBe('vision');
    expect(out.parsedText).toBe('a screenshot of a table');
    expect(m.describeImageWithVision).toHaveBeenCalledOnce();
  });

  it('rejects unsupported mimes with AttachmentParseError', async () => {
    mockParsers({});
    const { parseChatAttachment, AttachmentParseError } = await import(
      '@/lib/chat-attachments'
    );
    await expect(
      parseChatAttachment({
        buf: Buffer.from('x'),
        mime: 'application/zip',
        filename: 'archive.zip',
      }),
    ).rejects.toBeInstanceOf(AttachmentParseError);
  });

  it('throws AttachmentParseError when vision returns null', async () => {
    mockParsers({ visionText: null });
    const { parseChatAttachment, AttachmentParseError } = await import(
      '@/lib/chat-attachments'
    );
    await expect(
      parseChatAttachment({
        buf: Buffer.from('x'),
        mime: 'image/jpeg',
        filename: 'p.jpg',
      }),
    ).rejects.toBeInstanceOf(AttachmentParseError);
  });

  it('caps parsedText at MAX_PARSED_CHARS and sets truncated=true', async () => {
    const long = 'a'.repeat(10_000);
    mockParsers({ parseSourceText: long });
    const { parseChatAttachment, MAX_PARSED_CHARS } = await import(
      '@/lib/chat-attachments'
    );
    const out = await parseChatAttachment({
      buf: Buffer.from('x'),
      mime: 'application/pdf',
      filename: 'big.pdf',
    });
    expect(out.truncated).toBe(true);
    expect(out.parsedText.length).toBeLessThanOrEqual(MAX_PARSED_CHARS + 30);
    expect(out.parsedText).toContain('…[truncado]');
  });

  it('throws AttachmentParseError on empty parsed text', async () => {
    mockParsers({ parseSourceText: '   ' });
    const { parseChatAttachment, AttachmentParseError } = await import(
      '@/lib/chat-attachments'
    );
    await expect(
      parseChatAttachment({
        buf: Buffer.from('x'),
        mime: 'application/pdf',
        filename: 'empty.pdf',
      }),
    ).rejects.toBeInstanceOf(AttachmentParseError);
  });
});
