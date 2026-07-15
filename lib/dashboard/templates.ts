import type { Row } from './analyze';
import { panelId, type PanelConfig } from './panels';

// Templates prontos de dashboard — o usuário parte de uma tela montada e
// customiza. O de Logística cobre os KPIs do material de referência (status de
// entregas, OTIF, ocorrências, entregas por transportadora, custo de frete,
// tempo de ciclo, pedido perfeito), tudo em português.

export type DashboardTemplate = {
  key: string;
  name: string;
  description: string;
  rows: Row[];
  panels: PanelConfig[];
};

// LCG determinístico (sem Math.random) — dados estáveis entre renders/testes.
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const pick = <T>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)]!;

const TRANSPORTADORAS = ['Rodo Expresso', 'TransLog BR', 'Águia Cargas', 'Veloz Entregas', 'Norte-Sul Log', 'Prime Frete'];
const REGIOES = ['Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'];
const STATUS = ['Entregue', 'Entregue', 'Entregue', 'Em rota', 'Em conferência', 'Cancelada', 'Devolvida'];
const OCORRENCIAS = ['Sem ocorrência', 'Sem ocorrência', 'Sem ocorrência', 'Endereço incompleto', 'Ausência do responsável', 'Interdição na via', 'Avaria'];
const VEICULOS = ['Truck', 'Van', 'Carreta', 'VUC', 'Bitrem'];

function logisticaRows(): Row[] {
  const rng = lcg(20260715);
  const rows: Row[] = [];
  const now = new Date(2026, 6, 15); // 2026-07-15 fixo

  for (let i = 0; i < 460; i++) {
    const daysAgo = Math.floor(rng() * 180);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const transportadora = pick(rng, TRANSPORTADORAS);
    const status = pick(rng, STATUS);
    const ocorrencia = status === 'Entregue' && rng() < 0.8 ? 'Sem ocorrência' : pick(rng, OCORRENCIAS);
    const prazo = 1 + Math.floor(rng() * 12);
    const noPrazo = status === 'Entregue' && rng() < 0.86 ? 1 : 0;
    const pedidoPerfeito = noPrazo === 1 && ocorrencia === 'Sem ocorrência' ? 1 : 0;
    const frete = Math.round((250 + rng() * 3200) * (1 + REGIOES.indexOf(pick(rng, REGIOES)) * 0.04));

    rows.push({
      'Data': `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      'Transportadora': transportadora,
      'Região': pick(rng, REGIOES),
      'Status': status,
      'Ocorrência': ocorrencia,
      'Veículo': pick(rng, VEICULOS),
      'Valor Frete (R$)': frete,
      'Prazo (dias)': prazo,
      'OTIF': noPrazo,
      'Pedido Perfeito': pedidoPerfeito,
    });
  }
  return rows;
}

function logisticaPanels(): PanelConfig[] {
  const p = (c: Omit<PanelConfig, 'id'>): PanelConfig => ({ id: panelId(), ...c });
  return [
    p({ type: 'kpi', title: 'Total de entregas', measure: null, agg: 'count', format: 'number', size: 'sm' }),
    p({ type: 'kpi', title: 'OTIF (no prazo)', measure: 'OTIF', agg: 'mean', format: 'percent', size: 'sm' }),
    p({ type: 'kpi', title: 'Pedido perfeito', measure: 'Pedido Perfeito', agg: 'mean', format: 'percent', size: 'sm' }),
    p({ type: 'kpi', title: 'Custo de frete', measure: 'Valor Frete (R$)', agg: 'sum', format: 'currency', size: 'sm' }),
    p({ type: 'kpi', title: 'Tempo médio de ciclo', measure: 'Prazo (dias)', agg: 'mean', format: 'number', size: 'sm' }),
    p({ type: 'line', title: 'Entregas por mês', measure: null, dateColumn: 'Data', agg: 'count', format: 'number', size: 'lg' }),
    p({ type: 'donut', title: 'Status das entregas', measure: null, dimension: 'Status', agg: 'count', format: 'number', size: 'md' }),
    p({ type: 'bar', title: 'Custo de frete por transportadora', measure: 'Valor Frete (R$)', dimension: 'Transportadora', agg: 'sum', format: 'currency', size: 'md' }),
    p({ type: 'stacked', title: 'Transportadora × Status', measure: null, dimension: 'Transportadora', dimension2: 'Status', format: 'number', size: 'lg' }),
    p({ type: 'bar', title: 'Ocorrências no transporte', measure: null, dimension: 'Ocorrência', agg: 'count', format: 'number', size: 'md' }),
    p({ type: 'donut', title: 'Entregas por região', measure: null, dimension: 'Região', agg: 'count', format: 'number', size: 'md' }),
    p({ type: 'table', title: 'Desempenho por transportadora', measure: 'Valor Frete (R$)', dimension: 'Transportadora', agg: 'sum', format: 'currency', size: 'lg' }),
  ];
}

export function getTemplates(): DashboardTemplate[] {
  return [
    {
      key: 'logistica',
      name: 'Logística',
      description: 'Entregas, OTIF, ocorrências, frete por transportadora e tempo de ciclo.',
      rows: logisticaRows(),
      panels: logisticaPanels(),
    },
  ];
}
