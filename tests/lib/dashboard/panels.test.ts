import { describe, it, expect } from 'vitest';
import { buildDataset, planDashboard, type Row } from '@/lib/dashboard/analyze';
import { seedPanelsFromPlan, newPanel, computePanel, type PanelConfig } from '@/lib/dashboard/panels';
import { getTemplates } from '@/lib/dashboard/templates';

const rows: Row[] = [
  { data: '2026-01-05', regiao: 'SE', fornecedor: 'A', valor: 100 },
  { data: '2026-02-10', regiao: 'S', fornecedor: 'B', valor: 300 },
  { data: '2026-02-20', regiao: 'SE', fornecedor: 'A', valor: 200 },
];
const dataset = buildDataset(rows);
const plan = planDashboard(dataset.columns);

describe('seedPanelsFromPlan', () => {
  it('gera peças a partir do plano (kpi, linha, barras, tabela)', () => {
    const panels = seedPanelsFromPlan(plan);
    const types = panels.map((p) => p.type);
    expect(types).toContain('kpi');
    expect(types).toContain('bar');
    expect(types).toContain('line'); // tem coluna de data
    expect(panels.every((p) => p.id)).toBe(true);
  });
});

describe('newPanel', () => {
  it('manualKpi começa com valor 0 e formato número', () => {
    const p = newPanel('manualKpi', plan);
    expect(p.type).toBe('manualKpi');
    expect(p.manualValue).toBe(0);
    expect(p.format).toBe('number');
  });
  it('bar herda medida e dimensão primárias', () => {
    const p = newPanel('bar', plan);
    expect(p.measure).toBe('valor');
    expect(p.dimension).toBe('regiao');
  });
});

describe('computePanel', () => {
  const base = (over: Partial<PanelConfig>): PanelConfig => ({ id: 'x', type: 'kpi', title: 't', ...over });

  it('kpi soma a medida', () => {
    const d = computePanel(base({ type: 'kpi', measure: 'valor', agg: 'sum' }), dataset);
    expect(d.kind).toBe('kpi');
    if (d.kind === 'kpi') expect(d.value).toBe(600);
  });
  it('kpi sem medida conta registros', () => {
    const d = computePanel(base({ type: 'kpi', measure: null }), dataset);
    if (d.kind === 'kpi') expect(d.value).toBe(3);
  });
  it('manualKpi devolve o número digitado', () => {
    const d = computePanel(base({ type: 'manualKpi', manualValue: 42, format: 'currency' }), dataset);
    if (d.kind === 'kpi') expect(d.value).toBe(42);
  });
  it('bar agrupa por dimensão', () => {
    const d = computePanel(base({ type: 'bar', measure: 'valor', dimension: 'regiao', agg: 'sum' }), dataset);
    expect(d.kind).toBe('slices');
    if (d.kind === 'slices') expect(d.slices.find((s) => s.key === 'SE')?.value).toBe(300);
  });
  it('bar sem dimensão vira empty', () => {
    const d = computePanel(base({ type: 'bar', dimension: null }), dataset);
    expect(d.kind).toBe('empty');
  });
  it('line agrega por mês', () => {
    const d = computePanel(base({ type: 'line', measure: 'valor', dateColumn: 'data', agg: 'sum' }), dataset);
    expect(d.kind).toBe('series');
    if (d.kind === 'series') expect(d.points.length).toBe(2);
  });
});

describe('template de logística', () => {
  it('é determinístico e acende os painéis', () => {
    const a = getTemplates().find((t) => t.key === 'logistica')!;
    const b = getTemplates().find((t) => t.key === 'logistica')!;
    expect(a.rows.length).toBe(b.rows.length);
    expect(a.rows[0]).toEqual(b.rows[0]);
    expect(a.panels.length).toBeGreaterThan(6);
    const ds = buildDataset(a.rows);
    const otif = a.panels.find((p) => p.title.includes('OTIF'))!;
    const d = computePanel(otif, ds);
    expect(d.kind).toBe('kpi');
    if (d.kind === 'kpi') { expect(d.value).toBeGreaterThan(0); expect(d.value).toBeLessThanOrEqual(1); }
  });
});
