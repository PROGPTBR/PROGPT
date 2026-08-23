import { describe, it, expect, beforeEach, vi } from 'vitest';

beforeEach(() => vi.resetModules());

function setup(opts: { user?: { id: string } | null; allowed?: boolean } = {}) {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: vi.fn().mockResolvedValue('user' in opts ? opts.user : { id: 'u1' }),
  }));
  vi.doMock('@/lib/rate-limit', () => ({
    checkChatRateLimit: vi
      .fn()
      .mockResolvedValue(
        opts.allowed === false ? { allowed: false, retryAfterSecs: 30 } : { allowed: true },
      ),
  }));
  vi.doMock('@/lib/govdata/indicadores', () => ({
    isIndicadorKey: (k: string) => ['selic', 'cdi', 'ipca', 'igpm', 'usd', 'eur'].includes(k),
    serieIndicador: vi.fn().mockResolvedValue([
      { data: '01/05/2026', valor: 14.25 },
      { data: '02/05/2026', valor: 14.25 },
    ]),
  }));
}

function req(qs: string) {
  return new Request(`http://localhost/api/govdata/indicadores/serie${qs}`);
}

describe('GET /api/govdata/indicadores/serie', () => {
  it('401 sem usuário', async () => {
    setup({ user: null });
    const { GET } = await import('@/app/api/govdata/indicadores/serie/route');
    expect((await GET(req('?key=selic&meses=24'))).status).toBe(401);
  });

  it('429 rate-limited', async () => {
    setup({ allowed: false });
    const { GET } = await import('@/app/api/govdata/indicadores/serie/route');
    expect((await GET(req('?key=selic'))).status).toBe(429);
  });

  it('400 com key inválida', async () => {
    setup();
    const { GET } = await import('@/app/api/govdata/indicadores/serie/route');
    expect((await GET(req('?key=hacker'))).status).toBe(400);
  });

  it('200 com a série e clamp de meses', async () => {
    setup();
    const { GET } = await import('@/app/api/govdata/indicadores/serie/route');
    const res = await GET(req('?key=selic&meses=99999'));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { key: string; meses: number; pontos: unknown[] };
    expect(data.key).toBe('selic');
    expect(data.meses).toBe(240); // clampado
    expect(data.pontos.length).toBe(2);
  });
});

describe('GET /api/govdata/indicadores/xlsx', () => {
  it('repassa a metodologia do INDICADOR_META pro banner do .xlsx gerado', async () => {
    setup();
    vi.doMock('@/lib/govdata/indicadores', () => ({
      isIndicadorKey: (k: string) => k === 'igpdi',
      serieIndicador: vi.fn().mockResolvedValue([{ data: '01/05/2026', valor: 1.14 }]),
      INDICADOR_META: {
        igpdi: { codigo: 190, nome: 'IGP-DI (variação mensal)', unidade: '%', metodologia: 'FGV IBRE — teste' },
      },
    }));
    // NÃO mocka indicadores-xlsx — roda o serieXlsxBuffer real e inspeciona
    // o .xlsx resultante (evita mock leakage entre módulos compartilhados
    // com o describe abaixo, que testa serieXlsxBuffer isoladamente).
    const { GET } = await import('@/app/api/govdata/indicadores/xlsx/route');
    const res = await GET(new Request('http://localhost/api/govdata/indicadores/xlsx?key=igpdi&meses=12'));
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Série')!;
    const cellValues: string[] = [];
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') cellValues.push(v);
    });
    expect(cellValues.some((v) => v.includes('Metodologia: FGV IBRE — teste'))).toBe(true);
    expect(cellValues.some((v) => v.startsWith('Consultado em:'))).toBe(true);
  });
});

describe('serieXlsxBuffer', () => {
  it('gera um buffer .xlsx não vazio', async () => {
    const { serieXlsxBuffer } = await import('@/lib/govdata/indicadores-xlsx');
    const buf = await serieXlsxBuffer('Selic (meta)', '% a.a.', [
      { data: '01/05/2026', valor: 14.25 },
      { data: '02/05/2026', valor: 14.25 },
    ]);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // assinatura ZIP do .xlsx (PK\x03\x04)
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  // Batch K — banner ganha metodologia + data da consulta quando fornecidos.
  it('inclui linhas de metodologia e "consultado em" no banner quando passadas', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { serieXlsxBuffer } = await import('@/lib/govdata/indicadores-xlsx');
    const buf = await serieXlsxBuffer(
      'IGP-DI (variação mensal)',
      '%',
      [{ data: '01/05/2026', valor: 1.14 }],
      { metodologia: 'FGV IBRE — teste', consultadoEm: '2026-08-22T12:00:00.000Z' },
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Série')!;
    const cellValues: string[] = [];
    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (typeof v === 'string') cellValues.push(v);
    });
    expect(cellValues.some((v) => v.includes('Metodologia: FGV IBRE — teste'))).toBe(true);
    expect(cellValues.some((v) => v.startsWith('Consultado em:'))).toBe(true);
  });

  it('sem meta, mantém só as 2 linhas de banner originais (fonte)', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { serieXlsxBuffer } = await import('@/lib/govdata/indicadores-xlsx');
    const buf = await serieXlsxBuffer('Selic (meta)', '% a.a.', [{ data: '01/05/2026', valor: 14.25 }]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet('Série')!;
    expect(ws.getCell('A3').value).toBe('Data'); // header na linha 3 (sem linhas extras)
  });
});
