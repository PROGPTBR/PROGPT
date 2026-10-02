import { describe, it, expect } from 'vitest';
import { buildDataset, crosstab, type Row } from '@/lib/dashboard/analyze';
import { computePanel, newPanel, type PanelConfig } from '@/lib/dashboard/panels';
import { planDashboard } from '@/lib/dashboard/analyze';
import { fmtNumber } from '@/lib/dashboard/parse-file';
import { getTemplates } from '@/lib/dashboard/templates';

// Base no formato de uma carteira de solicitações de compra — o caso real que
// motivou os painéis de matriz e velocímetro (cliente 2026-10-01).
const rows: Row[] = [
  { sc: 'SC-1', comprador: 'Ana', criticidade: 'Alta', lead_time: 10, no_prazo: 'Sim' },
  { sc: 'SC-2', comprador: 'Ana', criticidade: 'Alta', lead_time: 20, no_prazo: 'Não' },
  { sc: 'SC-3', comprador: 'Ana', criticidade: 'Baixa', lead_time: 3, no_prazo: 'Sim' },
  { sc: 'SC-4', comprador: 'Bruno', criticidade: 'Alta', lead_time: 8, no_prazo: 'Sim' },
  { sc: 'SC-5', comprador: 'Bruno', criticidade: 'Baixa', lead_time: 4, no_prazo: 'Sim' },
];
const dataset = buildDataset(rows);
const plan = planDashboard(dataset.columns);

describe('crosstab com agregação', () => {
  it('soma por padrão (comportamento antigo preservado)', () => {
    const ct = crosstab(rows, 'comprador', 'criticidade', 'lead_time');
    expect(ct.matrix['Ana']?.['Alta']).toBe(30);
  });

  it('média é o que faz um heatmap de lead time dizer algo', () => {
    const ct = crosstab(rows, 'comprador', 'criticidade', 'lead_time', { agg: 'mean' });
    expect(ct.matrix['Ana']?.['Alta']).toBe(15);
    expect(ct.matrix['Bruno']?.['Alta']).toBe(8);
  });

  it('expõe o n de cada célula', () => {
    const ct = crosstab(rows, 'comprador', 'criticidade', 'lead_time', { agg: 'mean' });
    expect(ct.counts['Ana']?.['Alta']).toBe(2);
    expect(ct.counts['Bruno']?.['Baixa']).toBe(1);
  });

  it('célula sem linha nenhuma fica em zero, não em NaN', () => {
    const ct = crosstab(
      [{ comprador: 'Ana', criticidade: 'Alta', lead_time: 5 }],
      'comprador',
      'criticidade',
      'lead_time',
      { agg: 'mean' },
    );
    for (const ck of ct.colKeys) expect(Number.isNaN(ct.matrix['Ana']?.[ck])).toBe(false);
  });
});

describe('painel de matriz (heatmap)', () => {
  it('pede as duas dimensões antes de desenhar', () => {
    const cfg: PanelConfig = { id: 'p', type: 'heatmap', title: 'm', dimension: 'comprador' };
    expect(computePanel(cfg, dataset).kind).toBe('empty');
  });

  it('cruza comprador × criticidade com a média do lead time', () => {
    const cfg: PanelConfig = {
      id: 'p', type: 'heatmap', title: 'Lead time',
      measure: 'lead_time', agg: 'mean',
      dimension: 'comprador', dimension2: 'criticidade',
    };
    const data = computePanel(cfg, dataset);
    expect(data.kind).toBe('matrix');
    if (data.kind !== 'matrix') throw new Error('tipo inesperado');
    expect(data.crosstab.matrix['Ana']?.['Alta']).toBe(15);
  });

  it('nasce com média, não soma — somar lead time não significa nada', () => {
    expect(newPanel('heatmap', plan).agg).toBe('mean');
  });
});

describe('painel de velocímetro (taxa contra meta)', () => {
  const cfg: PanelConfig = {
    id: 'g', type: 'gauge', title: 'OTIF',
    dimension: 'no_prazo', matchValue: 'Sim', goal: 90,
  };

  it('mede a fatia de linhas que batem com o valor escolhido', () => {
    const data = computePanel(cfg, dataset);
    expect(data.kind).toBe('gauge');
    if (data.kind !== 'gauge') throw new Error('tipo inesperado');
    expect(data.value).toBe(80); // 4 de 5
    expect(data.matched).toBe(4);
    expect(data.total).toBe(5);
    expect(data.goal).toBe(90);
  });

  it('compara sem diferenciar maiúscula nem espaço em volta', () => {
    const sujo = buildDataset([
      { no_prazo: ' sim ' },
      { no_prazo: 'SIM' },
      { no_prazo: 'Não' },
    ]);
    const data = computePanel(cfg, sujo);
    if (data.kind !== 'gauge') throw new Error('tipo inesperado');
    expect(data.value).toBeCloseTo(66.67, 1);
  });

  // Célula em branco não é "fora do prazo": contar como não-atendido mentiria
  // sobre a taxa de quem simplesmente não preencheu a coluna.
  it('ignora linha com a coluna vazia', () => {
    const comVazio = buildDataset([
      { no_prazo: 'Sim' },
      { no_prazo: 'Não' },
      { no_prazo: '' },
      { no_prazo: null },
    ]);
    const data = computePanel(cfg, comVazio);
    if (data.kind !== 'gauge') throw new Error('tipo inesperado');
    expect(data.total).toBe(2);
    expect(data.value).toBe(50);
  });

  it('sem coluna e sem valor escolhido, avisa em vez de mostrar zero', () => {
    const data = computePanel({ id: 'g', type: 'gauge', title: 'x' }, dataset);
    expect(data.kind).toBe('empty');
  });
});

describe('KPI como taxa', () => {
  it('cartão de KPI também aceita o par coluna/valor', () => {
    const data = computePanel(
      { id: 'k', type: 'kpi', title: 'OTIF', dimension: 'no_prazo', matchValue: 'Sim' },
      dataset,
    );
    if (data.kind !== 'kpi') throw new Error('tipo inesperado');
    expect(data.value).toBe(80);
    expect(data.format).toBe('percent');
  });

  it('sem matchValue segue sendo contagem/medida como antes', () => {
    const data = computePanel({ id: 'k', type: 'kpi', title: 'n', dimension: 'no_prazo' }, dataset);
    if (data.kind !== 'kpi') throw new Error('tipo inesperado');
    expect(data.value).toBe(5);
  });
});

describe('fmtNumber', () => {
  it('mantém uma casa na média quebrada (4,3 dias ≠ 4 dias)', () => {
    expect(fmtNumber(4.3)).toBe('4,3');
  });

  it('contagem inteira continua sem casa decimal', () => {
    expect(fmtNumber(12)).toBe('12');
  });
});

describe('template Carteira de Compras', () => {
  const tpl = getTemplates().find((t) => t.key === 'compras')!;
  const ds = buildDataset(tpl.rows);

  it('existe e traz os painéis que o cliente pediu', () => {
    expect(tpl).toBeTruthy();
    const tipos = tpl.panels.map((p) => p.type);
    expect(tipos.filter((t) => t === 'kpi')).toHaveLength(4);
    expect(tipos).toContain('bar');
    expect(tipos).toContain('donut');
    expect(tipos).toContain('line');
    expect(tipos).toContain('heatmap');
    expect(tipos).toContain('gauge');
    expect(tipos.filter((t) => t === 'table')).toHaveLength(2);
  });

  // O ponto que motivou tudo: não basta a peça existir, ela precisa DESENHAR
  // com a planilha esperada. Painel que cai em "empty" é o cliente abrindo a
  // tela e vendo um retângulo vazio.
  it('todo painel desenha com os dados do próprio template', () => {
    for (const cfg of tpl.panels) {
      const data = computePanel(cfg, ds);
      expect(data.kind, `${cfg.title} ficou vazio`).not.toBe('empty');
    }
  });

  it('o velocímetro olha só os críticos, não a carteira inteira', () => {
    const gauge = tpl.panels.find((p) => p.type === 'gauge')!;
    expect(gauge.filterColumn).toBe('Criticidade');
    expect(gauge.filterValue).toBe('Alta');

    const todos = computePanel({ ...gauge, filterColumn: null, filterValue: null }, ds);
    const criticos = computePanel(gauge, ds);
    if (todos.kind !== 'gauge' || criticos.kind !== 'gauge') throw new Error('tipo inesperado');
    expect(criticos.total).toBeLessThan(todos.total);
  });

  it('a tabela de atraso conta só o que atrasou', () => {
    const tabela = tpl.panels.find((p) => p.title.includes('atraso'))!;
    const data = computePanel(tabela, ds);
    if (data.kind !== 'table') throw new Error('tipo inesperado');
    const somaTabela = data.rows.reduce((acc, r) => acc + r.value, 0);
    const atrasados = tpl.rows.filter((r) => r['Entregue no prazo'] === 'Não').length;
    expect(somaTabela).toBe(atrasados);
  });
});
