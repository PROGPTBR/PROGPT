import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function setup(opts: {
  user?: { id: string } | null;
  run?: { assistant_type: string; status: string; params: unknown } | null;
} = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  vi.doMock('@/lib/assistants/runs', () => ({
    getRunForOwner: vi
      .fn()
      .mockResolvedValue(
        'run' in opts
          ? opts.run
          : { assistant_type: 'spend_analysis', status: 'done', params: { analysisName: 'X', referenceCurrency: 'BRL' } },
      ),
  }));
  vi.doMock('@/lib/spend/db', () => ({
    listInvoicesByRun: vi.fn().mockResolvedValue([
      {
        id: 'a',
        status: 'done',
        invoice_number: 'INV-1',
        po_number: 'PO-1',
        supplier: 'Acme',
        supplier_normalized: 'ACME',
        category: 'Outros',
        country: 'Brasil',
        currency: 'BRL',
        total: 100,
        total_ref: 100,
        payment_terms: 'Net 30',
        invoice_date: '2025-01-01',
        low_confidence: false,
      },
    ]),
  }));
}

const req = () => new Request('http://localhost/api/assistants/spend_analysis/r1/dashboard');
const ctx = { params: { runId: 'r1' } };

describe('GET /api/assistants/spend_analysis/[runId]/dashboard', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { GET } = await import('@/app/api/assistants/spend_analysis/[runId]/dashboard/route');
    expect((await GET(req(), ctx)).status).toBe(401);
  });

  it('404 quando o run não é spend_analysis', async () => {
    setup({ run: { assistant_type: 'abc', status: 'done', params: {} } });
    const { GET } = await import('@/app/api/assistants/spend_analysis/[runId]/dashboard/route');
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it('409 quando ainda não está pronto', async () => {
    setup({ run: { assistant_type: 'spend_analysis', status: 'running', params: {} } });
    const { GET } = await import('@/app/api/assistants/spend_analysis/[runId]/dashboard/route');
    expect((await GET(req(), ctx)).status).toBe(409);
  });

  it('200 retorna as linhas e a moeda de referência', async () => {
    setup();
    const { GET } = await import('@/app/api/assistants/spend_analysis/[runId]/dashboard/route');
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { referenceCurrency: string; rows: { id: string }[] };
    expect(data.referenceCurrency).toBe('BRL');
    expect(data.rows[0]!.id).toBe('a');
  });
});
