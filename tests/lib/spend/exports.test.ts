import { describe, it, expect } from 'vitest';
import { computeSpendCube } from '@/lib/spend/cube';
import { renderSpendParetoPng, renderSpendByCategoryPng } from '@/lib/assistants/spend-chart';
import { buildSpendXlsxBuffer } from '@/lib/assistants/spend-xlsx';
import { buildSpendNarrativePrompt } from '@/lib/spend/narrative';
import { buildSpendRefineSystem, buildRefineSystemForType, SPEND_REFINE_SYSTEM_PROMPT } from '@/lib/assistants/refine';
import type { CubeInvoice, SpendInvoiceRow } from '@/lib/spend/types';
import type { SpendAnalysisParams } from '@/lib/assistants/types';

const params = {
  analysisName: 'Carteira 2025',
  period: 'FY2025',
  referenceCurrency: 'BRL',
  fxMode: 'ptax',
  notes: '',
} as SpendAnalysisParams;

const cubeRows: CubeInvoice[] = [
  { supplier: 'Acme', supplierNormalized: 'ACME', category: 'Produção e Embalagem', country: 'Brasil', currency: 'BRL', total: 1500, totalRef: 1500, poNumber: 'PO-1', invoiceDate: '2025-01-10' },
  { supplier: 'Globex', supplierNormalized: 'GLOBEX', category: 'Consultoria e Serviços Profissionais', country: 'Brasil', currency: 'BRL', total: 600, totalRef: 600, poNumber: 'Sem PO', invoiceDate: '2025-02-10' },
];
const cube = computeSpendCube(cubeRows, 'BRL');

const rows: SpendInvoiceRow[] = cubeRows.map((c, i) => ({
  id: `r${i}`,
  run_id: 'run-1',
  user_id: 'u1',
  storage_path: null,
  filename: `nf${i}.pdf`,
  source: 'pdf',
  status: 'done',
  invoice_number: `INV-${i}`,
  po_number: c.poNumber,
  country: c.country,
  currency: c.currency,
  total: c.total,
  total_ref: c.totalRef,
  fx_rate: 1,
  payment_terms: 'Net 30',
  description: 'item',
  supplier: c.supplier,
  supplier_normalized: c.supplierNormalized,
  invoice_date: c.invoiceDate,
  category: c.category,
  category_justification: '',
  low_confidence: false,
  ocr_used: false,
  error_message: null,
  created_at: '',
  updated_at: '',
}));

describe('spend exports', () => {
  it('renderSpendParetoPng gera um PNG não-vazio', async () => {
    const buf = await renderSpendParetoPng(cube);
    expect(buf.length).toBeGreaterThan(1000);
  });
  it('renderSpendByCategoryPng gera um PNG não-vazio', async () => {
    const buf = await renderSpendByCategoryPng(cube);
    expect(buf.length).toBeGreaterThan(1000);
  });
  it('buildSpendXlsxBuffer gera um workbook não-vazio', async () => {
    const buf = await buildSpendXlsxBuffer(params, rows, cube);
    expect(buf.length).toBeGreaterThan(1000);
  });
});

describe('spend narrative prompt', () => {
  it('injeta os números do cube e os fornecedores; pede recomendações', () => {
    const { system, user } = buildSpendNarrativePrompt({
      cube,
      topInvoices: rows,
      params,
      chunks: [],
      company: null,
    });
    expect(system).toMatch(/strategic sourcing/i);
    expect(system).toMatch(/Recomenda/i);
    expect(user).toContain('Acme');
    expect(user).toContain('spend-cube');
  });
});

describe('spend refine dispatch', () => {
  it('buildRefineSystemForType("spend_analysis") usa o prompt de refine de gastos', () => {
    const out = buildRefineSystemForType('spend_analysis', '# Relatório de gastos', params, []);
    expect(out).toContain(SPEND_REFINE_SYSTEM_PROMPT);
    expect(out).toMatch(/<report>/);
    expect(out).toContain('Carteira 2025');
  });
  it('buildSpendRefineSystem inclui o relatório e a base', () => {
    const out = buildSpendRefineSystem('# meu relatório', params, []);
    expect(out).toContain('meu relatório');
  });
});
