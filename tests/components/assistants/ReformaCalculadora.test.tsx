// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ReformaCalculadora } from '@/components/assistants/ReformaCalculadora';

const classificacoes = [
  { codigo: '000001', cst: '000', cstDescricao: 'Tributação integral', descricao: 'Situações tributadas integralmente pelo IBS e CBS.', tratamento: 'Tributação integral', nomenclatura: 'NCM', reducaoCbs: 0, reducaoIbsUf: 0, reducaoIbsMun: 0, creditoCbs: true, creditoIbs: true },
  { codigo: '200003', cst: '200', cstDescricao: 'Alíquota reduzida', descricao: 'Vendas de produtos destinados à alimentação humana (Anexo I)', tratamento: 'Redução de 100%', nomenclatura: 'NCM', reducaoCbs: 100, reducaoIbsUf: 100, reducaoIbsMun: 100, creditoCbs: true, creditoIbs: true },
  { codigo: '200035', cst: '200', cstDescricao: 'Alíquota reduzida', descricao: 'Fornecimento dos produtos de higiene pessoal e limpeza (Anexo VIII)', tratamento: 'Redução de 60%', nomenclatura: 'NCM', reducaoCbs: 60, reducaoIbsUf: 60, reducaoIbsMun: 60, creditoCbs: true, creditoIbs: true },
];

function item(total: number) {
  return { cbs: total / 3, ibsUf: 0, ibsMun: 0, ibs: (2 * total) / 3, total, aliqCbs: 8.8, aliqIbs: 17.7, reducao: 0, aliquotaEfetiva: 26.5, credito: total, custoReal: 1000, memoria: 'Base legal: LC 214/2025' };
}

const resultado = {
  anos: [2026, 2027, 2029, 2031, 2033].map((ano) => ({
    ano,
    rotulo: ano === 2026 ? '2026 · teste' : ano === 2033 ? '2033 · completa' : String(ano),
    oficial: ano === 2026,
    itens: [item(10), item(0), item(5), item(20)],
    total: { valor: 24370, cbs: 100, ibs: 200, total: 300, credito: 300, custoReal: 24370 },
  })),
};

function mockFetch() {
  const calls: Array<{ url: string; body?: unknown }> = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 });
    if (url.startsWith('/api/reforma/base'))
      return json({
        versao: { versaoApp: '1.6.2-a39944eb', versaoDb: 'V0066', dataVersaoDb: '2026-10-28' },
        ufs: [{ sigla: 'PR', nome: 'PARANÁ', codigo: 41 }, { sigla: 'SP', nome: 'SÃO PAULO', codigo: 35 }],
        classificacoes,
      });
    if (url.startsWith('/api/reforma/municipios?uf=PR')) return json({ municipios: [{ codigo: 4100103, nome: 'Abatiá' }, { codigo: 4106902, nome: 'Curitiba' }] });
    if (url.startsWith('/api/reforma/municipios')) return json({ municipios: [{ codigo: 3550308, nome: 'São Paulo' }] });
    if (url.startsWith('/api/reforma/calcular')) return json(resultado);
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Calculadora da Reforma', () => {
  it('mostra o motor oficial conectado com a versão e a data das regras', async () => {
    mockFetch();
    render(<ReformaCalculadora />);
    expect(await screen.findByText(/Motor oficial conectado · versão 1\.6\.2 · regras atualizadas em 28\/10\/2026/)).toBeTruthy();
  });

  it('carrega o exemplo, calcula no motor e mostra o resultado ano a ano', async () => {
    const calls = mockFetch();
    render(<ReformaCalculadora />);
    await screen.findByText(/Motor oficial conectado/);

    fireEvent.click(screen.getByRole('button', { name: /Carregar exemplo/ }));
    // UF do exemplo é o PR: município cai na capital.
    await waitFor(() => expect((screen.getByLabelText('Município') as HTMLSelectElement).value).toBe('4106902'));
    expect(screen.getByDisplayValue('Leite UHT integral 1 L')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Calcular com o motor oficial/ }));
    expect(await screen.findByText('Resultado ano a ano')).toBeTruthy();

    const pedido = calls.find((c) => c.url === '/api/reforma/calcular')!.body as {
      uf: string;
      municipio: number;
      regime: string;
      referencia: { cbs: number; ibs: number };
      itens: Array<{ cst: string; cClassTrib: string; valor: number }>;
    };
    expect(pedido).toMatchObject({ uf: 'PR', municipio: 4106902, regime: 'regular', referencia: { cbs: 8.8, ibs: 17.7 } });
    expect(pedido.itens).toHaveLength(4);
    // O CST vai junto com a classificação (o motor exige os dois).
    expect(pedido.itens[1]).toMatchObject({ cst: '200', cClassTrib: '200003', valor: 3200 });

    const tabelaAnos = screen.getAllByRole('table')[0]!;
    expect(within(tabelaAnos).getByText(/2033 · completa/)).toBeTruthy();
    expect(within(tabelaAnos).getAllByText(/alíquota de referência/).length).toBe(4);
    expect(screen.getByText(/Memória de cálculo e base legal/)).toBeTruthy();
  });

  it('não calcula sem valor no item', async () => {
    const calls = mockFetch();
    render(<ReformaCalculadora />);
    await screen.findByText(/Motor oficial conectado/);
    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Item sem valor' } });
    fireEvent.click(screen.getByRole('button', { name: /Calcular com o motor oficial/ }));
    await waitFor(() => expect(calls.some((c) => c.url === '/api/reforma/calcular')).toBe(false));
  });
});
