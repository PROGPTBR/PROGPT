import { describe, it, expect } from 'vitest';
import { computeSpendCube, hasPurchaseOrder } from '@/lib/spend/cube';
import type { CubeInvoice } from '@/lib/spend/types';

// Fixture multi-moeda: 4 notas com câmbio resolvido (totalRef) + 1 em INR sem
// conversão (totalRef null → entra só em semCambio).
const FIX: CubeInvoice[] = [
  {
    supplier: 'Acme Corp',
    supplierNormalized: 'ACME CORP',
    category: 'Produção e Embalagem',
    country: 'Brasil',
    currency: 'BRL',
    total: 1000,
    totalRef: 1000,
    poNumber: 'PO-1',
    invoiceDate: '2025-01-15',
  },
  {
    supplier: 'Acme Corp.',
    supplierNormalized: 'ACME CORP',
    category: 'Produção e Embalagem',
    country: 'Brasil',
    currency: 'BRL',
    total: 500,
    totalRef: 500,
    poNumber: 'PO-2',
    invoiceDate: '2025-02-10',
  },
  {
    supplier: 'Globex',
    supplierNormalized: 'GLOBEX',
    category: 'Consultoria e Serviços Profissionais',
    country: 'Estados Unidos',
    currency: 'USD',
    total: 100,
    totalRef: 600,
    poNumber: 'Sem PO',
    invoiceDate: '2025-01-20',
  },
  {
    supplier: 'Initech',
    supplierNormalized: 'INITECH',
    category: 'Telecomunicações',
    country: 'Brasil',
    currency: 'BRL',
    total: 200,
    totalRef: 200,
    poNumber: null,
    invoiceDate: '2025-03-05',
  },
  {
    supplier: 'Umbrella',
    supplierNormalized: 'UMBRELLA',
    category: 'Outros',
    country: 'Índia',
    currency: 'INR',
    total: 5000,
    totalRef: null, // sem câmbio
    poNumber: 'PO-9',
    invoiceDate: '2025-02-01',
  },
];

describe('hasPurchaseOrder', () => {
  it('true só com número de PO real', () => {
    expect(hasPurchaseOrder('PO-1')).toBe(true);
    expect(hasPurchaseOrder('12345')).toBe(true);
    expect(hasPurchaseOrder('Sem PO')).toBe(false);
    expect(hasPurchaseOrder('sem po')).toBe(false);
    expect(hasPurchaseOrder('Não informado')).toBe(false);
    expect(hasPurchaseOrder('')).toBe(false);
    expect(hasPurchaseOrder('-')).toBe(false);
    expect(hasPurchaseOrder(null)).toBe(false);
  });
});

describe('computeSpendCube', () => {
  const cube = computeSpendCube(FIX, 'BRL');

  it('soma apenas notas com câmbio; ignora as semCambio no totalRef', () => {
    expect(cube.totalRef).toBe(2300); // 1000+500+600+200
    expect(cube.invoiceCount).toBe(4);
    expect(cube.referenceCurrency).toBe('BRL');
  });

  it('agrupa fornecedor pelo normalizado e exibe o nome original', () => {
    expect(cube.bySupplier[0]).toMatchObject({ key: 'Acme Corp', totalRef: 1500, count: 2 });
    expect(cube.bySupplier[1]).toMatchObject({ key: 'Globex', totalRef: 600, count: 1 });
    expect(cube.bySupplier[2]).toMatchObject({ key: 'Initech', totalRef: 200, count: 1 });
  });

  it('quebra por categoria e país com pct sobre o totalRef', () => {
    const prod = cube.byCategory.find((c) => c.key === 'Produção e Embalagem');
    expect(prod?.totalRef).toBe(1500);
    expect(prod?.pct).toBeCloseTo(1500 / 2300, 5);
    const brasil = cube.byCountry.find((c) => c.key === 'Brasil');
    expect(brasil?.totalRef).toBe(1700); // 1000+500+200
  });

  it('Pareto de fornecedores com cumulativo crescente até 1', () => {
    expect(cube.pareto.map((p) => p.key)).toEqual(['Acme Corp', 'Globex', 'Initech']);
    expect(cube.pareto[0]!.cumPct).toBeCloseTo(1500 / 2300, 5);
    expect(cube.pareto[2]!.cumPct).toBeCloseTo(1, 5);
  });

  it('tail spend = fornecedores cujo cumulativo anterior já passou de 80%', () => {
    expect(cube.tailSpend.suppliersBeyond80Pct).toBe(1);
    expect(cube.tailSpend.tailSpendRef).toBe(200); // Initech
  });

  it('cobertura de PO sobre todas as notas; spend com PO sobre o ref', () => {
    expect(cube.poCoveragePct).toBeCloseTo(3 / 5, 5); // A,B,E têm PO
    expect(cube.poSpendPct).toBeCloseTo(1500 / 2300, 5); // só A,B no escopo ref
  });

  it('série mensal cronológica', () => {
    expect(cube.byMonth.map((m) => m.key)).toEqual(['2025-01', '2025-02', '2025-03']);
    expect(cube.byMonth[0]).toMatchObject({ key: '2025-01', totalRef: 1600, count: 2 });
  });

  it('moedas sem câmbio reportadas à parte', () => {
    expect(cube.semCambio).toEqual([{ currency: 'INR', total: 5000, count: 1 }]);
  });

  it('ticket médio sobre as notas com câmbio', () => {
    expect(cube.ticketMedio).toBeCloseTo(2300 / 4, 5);
  });

  it('lista vazia não quebra', () => {
    const empty = computeSpendCube([], 'BRL');
    expect(empty.totalRef).toBe(0);
    expect(empty.ticketMedio).toBe(0);
    expect(empty.poCoveragePct).toBe(0);
    expect(empty.bySupplier).toEqual([]);
  });
});
