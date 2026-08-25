import { describe, expect, it, beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

function mockAuth(user: { id: string } | null) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue(user),
  }));
}

function mockRateLimit(allowed: boolean) {
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(allowed ? { allowed: true } : { allowed: false, retryAfterSecs: 5 }),
  }));
}

// A inferência bate na OpenAI — mockamos pra devolver um mapeamento
// determinístico e manter o teste da rota rápido/offline. A lógica de
// inferência em si é coberta por quick-chart-infer.test.ts.
function mockInfer() {
  vi.doMock('@/lib/charts/quick-chart-infer', () => ({
    inferQuickChartSpec: vi.fn().mockImplementation(async (table, overrideChartType, title) => ({
      chartType: overrideChartType ?? 'bar',
      categoryColumn: table.headers[0],
      valueColumn: table.headers[1],
      title: title ?? 'Gráfico de teste',
    })),
  }));
}

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

function makeReq(form: FormData): Request {
  return new Request('http://localhost/api/tools/quick-chart', { method: 'POST', body: form });
}

const VALID_TEXT = 'Fornecedor\tGasto\nACME\t120000\nGlobex\t80500';

describe('POST /api/tools/quick-chart', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: VALID_TEXT })));
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(false);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: VALID_TEXT })));
    expect(res.status).toBe(429);
  });

  it('returns 400 no_data when neither text nor file is provided', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({})));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('no_data');
  });

  it('returns 400 need_two_columns for a single-column paste', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: 'SoUmaColuna\nx\ny' })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('need_two_columns');
  });

  it('returns a PNG (base64) + inferred spec for valid pasted data', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: VALID_TEXT })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.spec).toEqual({
      chartType: 'bar',
      categoryColumn: 'Fornecedor',
      valueColumn: 'Gasto',
      title: 'Gráfico de teste',
    });
    expect(body.rowsUsed).toBe(2);
    expect(typeof body.pngBase64).toBe('string');
    expect(body.pngBase64.length).toBeGreaterThan(100);
  });

  it('honors an explicit chartType override', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: VALID_TEXT, chartType: 'pie' })));
    const body = await res.json();
    expect(body.spec.chartType).toBe('pie');
  });

  it('ignores an invalid chartType value (falls back to auto)', async () => {
    mockAuth({ id: 'u1' });
    mockRateLimit(true);
    mockInfer();
    const { POST } = await import('@/app/api/tools/quick-chart/route');
    const res = await POST(makeReq(makeForm({ text: VALID_TEXT, chartType: 'nonsense' })));
    const body = await res.json();
    expect(body.spec.chartType).toBe('bar');
  });
});
