import { describe, expect, it, beforeEach, vi } from 'vitest';
import ExcelJS from 'exceljs';

beforeEach(() => vi.resetModules());
const mockUser = (u: unknown) =>
  vi.doMock('@/lib/auth', async () => ({ ...(await vi.importActual<object>('@/lib/auth')), getCurrentUser: vi.fn().mockResolvedValue(u) }));
const corpo = {
  nomeArquivo: 'relatorio-fornecedores-teste',
  relatorio: {
    titulo: 'Relatório de busca de fornecedores', geradoEm: '08/10/2026 09:00',
    resumo: [['Pedido', 'caneta']],
    secoes: [
      { titulo: 'Empresas na base da Receita Federal', colunas: ['Empresa', 'CNPJ'], linhas: [['ALFA', '12.345.678/0001-90']] },
      { titulo: 'Na internet', colunas: ['Empresa', 'Site'], linhas: [['Loja', 'https://loja.com.br']] },
    ],
  },
};
const req = (b: unknown) => new Request('http://x/api/suppliers/relatorio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

describe('/api/suppliers/relatorio (Excel)', () => {
  it('401 sem login', async () => {
    mockUser(null);
    const { POST } = await import('@/app/api/suppliers/relatorio/route');
    expect((await POST(req(corpo))).status).toBe(401);
  });

  it('devolve o .xlsx com resumo e uma aba por seção', async () => {
    mockUser({ id: 'u1' });
    const { POST } = await import('@/app/api/suppliers/relatorio/route');
    const res = await POST(req(corpo));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Disposition')).toContain('relatorio-fornecedores-teste.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resumo', 'Receita Federal', 'Internet']);
    expect(wb.getWorksheet('Receita Federal')!.getRow(2).values).toEqual([undefined, 'ALFA', '12.345.678/0001-90']);
  });
});
