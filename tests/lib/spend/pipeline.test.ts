import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

// O pipeline deve sobreviver à falha de extração de uma nota: marca a linha
// como erro e ainda assim conclui o run (updateRunOutput), sem failRun.
describe('runSpendPipeline — falha parcial', () => {
  it('uma extração falha → linha vira erro, run conclui mesmo assim', async () => {
    const run = {
      id: 'r1',
      status: 'running',
      params: { analysisName: 'X', referenceCurrency: 'BRL', fxMode: 'ptax' },
    };
    const rows = [
      { id: 'a', source: 'pdf', status: 'pending', storage_path: 'p/a', filename: 'a.pdf' },
      { id: 'b', source: 'pdf', status: 'pending', storage_path: 'p/b', filename: 'b.pdf' },
    ];

    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: run }) }),
          }),
        }),
      }),
    }));

    const updateRunOutput = vi.fn().mockResolvedValue(true);
    const failRun = vi.fn().mockResolvedValue(true);
    vi.doMock('@/lib/assistants/runs', () => ({ updateRunOutput, failRun }));

    vi.doMock('@/lib/db/spend-storage', () => ({
      downloadFromSpendBucket: vi.fn().mockResolvedValue(Buffer.from('pdf')),
    }));

    vi.doMock('@/lib/spend/invoice-extract', () => ({
      extractInvoiceFromPdf: vi.fn(async ({ filename }: { filename: string }) => {
        if (filename === 'b.pdf') throw new Error('extração falhou');
        return {
          invoiceNumber: 'INV-1',
          poNumber: 'PO-1',
          country: 'Brasil',
          currency: 'BRL',
          total: 100,
          supplier: 'Acme',
          invoiceDate: '2025-01-10',
          category: 'Outros',
          categoryJustification: 'x',
          lowConfidence: false,
          ocrUsed: false,
        };
      }),
    }));

    vi.doMock('@/lib/spend/classify', () => ({
      classifyCategories: vi.fn().mockResolvedValue(new Map()),
    }));

    vi.doMock('@/lib/spend/fx', () => ({
      buildFxResolver: vi
        .fn()
        .mockResolvedValue((input: { total: number | null }) => ({
          totalRef: input.total,
          fxRate: 1,
        })),
    }));

    // narrativa: stub p/ não tocar a rede (retrieve/rerank/LLM)
    vi.doMock('@/lib/rag/retriever', () => ({ retrieve: vi.fn().mockResolvedValue([]) }));
    vi.doMock('@/lib/rag/reranker', () => ({ rerank: vi.fn().mockResolvedValue([]) }));
    vi.doMock('@/lib/db/user-company', () => ({ getUserCompany: vi.fn().mockResolvedValue(null) }));
    vi.doMock('@/lib/spend/narrative', () => ({
      buildSpendNarrativePrompt: vi.fn().mockReturnValue({ system: '', user: '' }),
      generateSpendNarrative: vi.fn().mockResolvedValue('## Recomendações'),
    }));

    const updateInvoice = vi.fn().mockResolvedValue(undefined);
    const applyExtractedFields = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@/lib/spend/db', () => ({
      listInvoicesByRun: vi.fn().mockResolvedValue(rows),
      applyExtractedFields,
      updateInvoice,
      statusCountsForRun: vi.fn().mockResolvedValue({
        total: 2,
        pending: 0,
        extracting: 0,
        done: 1,
        needs_review: 0,
        error: 1,
      }),
    }));

    const { runSpendPipeline } = await import('@/lib/spend/pipeline');
    await runSpendPipeline('r1');

    expect(updateRunOutput).toHaveBeenCalledTimes(1);
    expect(failRun).not.toHaveBeenCalled();
    // a nota 'b' foi marcada como erro
    const errorCall = updateInvoice.mock.calls.find(
      (c) => c[0] === 'b' && (c[1] as { status?: string }).status === 'error',
    );
    expect(errorCall).toBeDefined();
  });

  it('zero notas → failRun', async () => {
    const run = { id: 'r2', status: 'running', params: { analysisName: 'X', referenceCurrency: 'BRL' } };
    vi.doMock('@/lib/db/supabase', () => ({
      getServerSupabase: () => ({
        from: () => ({
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: run }) }) }),
        }),
      }),
    }));
    const failRun = vi.fn().mockResolvedValue(true);
    vi.doMock('@/lib/assistants/runs', () => ({ updateRunOutput: vi.fn(), failRun }));
    vi.doMock('@/lib/db/spend-storage', () => ({ downloadFromSpendBucket: vi.fn() }));
    vi.doMock('@/lib/spend/invoice-extract', () => ({ extractInvoiceFromPdf: vi.fn() }));
    vi.doMock('@/lib/spend/classify', () => ({ classifyCategories: vi.fn() }));
    vi.doMock('@/lib/spend/fx', () => ({ buildFxResolver: vi.fn() }));
    vi.doMock('@/lib/spend/db', () => ({
      listInvoicesByRun: vi.fn().mockResolvedValue([]),
      applyExtractedFields: vi.fn(),
      updateInvoice: vi.fn(),
      statusCountsForRun: vi.fn(),
    }));

    const { runSpendPipeline } = await import('@/lib/spend/pipeline');
    await runSpendPipeline('r2');
    expect(failRun).toHaveBeenCalledTimes(1);
  });
});
