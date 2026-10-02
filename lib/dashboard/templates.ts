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


// ─── Carteira de Compras (SCs e Pedidos) ────────────────────────────────────
//
// Desenhado a partir do pedido de um cliente (01/10/2026): os painéis abaixo
// são, um a um, os que ele listou — 4 KPIs, barras por comprador, rosca de
// criticidade, linha do backlog, matriz de lead time, velocímetro de
// atendimento no prazo dos críticos e as duas tabelas de ranking.
//
// Os nomes de coluna aqui são o contrato: uma planilha com estas colunas
// reproduz este painel com os dados reais do cliente.

const COMPRADORES = ['Ana Ribeiro', 'Bruno Tavares', 'Carla Nunes', 'Diego Prado', 'Elisa Moraes', 'Felipe Araújo'];
const CRITICIDADES = ['Alta', 'Alta', 'Média', 'Média', 'Média', 'Baixa'];
const STATUS_SC = ['Em aberto', 'Em aberto', 'Em cotação', 'Pedido emitido', 'Entregue', 'Entregue', 'Cancelada'];
const FORNECEDORES_SC = ['Metalúrgica Souza', 'Rolamentos BR', 'Hidráulica Prime', 'Elétrica Central', 'Ferramentas Vale', 'Insumos Atlântico', 'Peças Norte'];
const FAMILIAS = ['Rolamento', 'Mangueira hidráulica', 'Contator', 'Correia', 'Filtro', 'Parafuso', 'Luva de proteção'];

function comprasRows(): Row[] {
  const rng = lcg(20261001);
  const rows: Row[] = [];
  const hoje = new Date(2026, 9, 1); // 2026-10-01 fixo

  for (let i = 0; i < 480; i++) {
    const diasAtras = Math.floor(rng() * 180);
    const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - diasAtras);
    const comprador = pick(rng, COMPRADORES);
    const criticidade = pick(rng, CRITICIDADES);
    const status = pick(rng, STATUS_SC);
    const entregue = status === 'Entregue';

    // Lead time cresce quando a criticidade é baixa (fila) e varia por comprador.
    const base = criticidade === 'Alta' ? 6 : criticidade === 'Média' ? 11 : 18;
    const vies = COMPRADORES.indexOf(comprador) * 0.9;
    const leadTime = Math.max(1, Math.round(base + vies + rng() * 10 - 4));

    const noPrazo = entregue ? (rng() < (criticidade === 'Alta' ? 0.88 : 0.79) ? 'Sim' : 'Não') : '';

    rows.push({
      'Data abertura': `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      'SC': `SC-${String(10_000 + i)}`,
      'Comprador': comprador,
      'Criticidade': criticidade,
      'Status': status,
      'Fornecedor': pick(rng, FORNECEDORES_SC),
      'Item': pick(rng, FAMILIAS),
      'Lead time (dias)': leadTime,
      'Entregue no prazo': noPrazo,
      'Valor (R$)': Math.round(300 + rng() * 24_000),
    });
  }
  return rows;
}

function comprasPanels(): PanelConfig[] {
  const p = (c: Omit<PanelConfig, 'id'>): PanelConfig => ({ id: panelId(), ...c });
  return [
    p({ type: 'kpi', title: 'SCs em aberto', dimension: 'Status', matchValue: 'Em aberto', rateMode: 'count', format: 'number', size: 'sm' }),
    p({ type: 'kpi', title: 'Pedidos críticos', dimension: 'Criticidade', matchValue: 'Alta', rateMode: 'count', format: 'number', size: 'sm' }),
    p({ type: 'kpi', title: 'Lead time médio (dias)', measure: 'Lead time (dias)', agg: 'mean', format: 'number', size: 'sm' }),
    p({ type: 'kpi', title: 'Taxa OTIF', dimension: 'Entregue no prazo', matchValue: 'Sim', rateMode: 'percent', format: 'percent', size: 'sm' }),

    p({ type: 'bar', title: 'SCs abertas por comprador', dimension: 'Comprador', agg: 'count', format: 'number', size: 'md', filterColumn: 'Status', filterValue: 'Em aberto' }),
    p({ type: 'donut', title: 'Criticidade das SCs', dimension: 'Criticidade', agg: 'count', format: 'number', size: 'md' }),

    p({ type: 'line', title: 'Evolução do backlog (SCs em aberto)', dateColumn: 'Data abertura', agg: 'count', format: 'number', size: 'lg', filterColumn: 'Status', filterValue: 'Em aberto' }),

    p({ type: 'heatmap', title: 'Lead time médio · comprador × criticidade', measure: 'Lead time (dias)', agg: 'mean', dimension: 'Comprador', dimension2: 'Criticidade', format: 'number', size: 'lg' }),

    p({ type: 'gauge', title: 'No prazo · pedidos críticos', dimension: 'Entregue no prazo', matchValue: 'Sim', goal: 95, format: 'percent', size: 'md', filterColumn: 'Criticidade', filterValue: 'Alta' }),
    p({ type: 'table', title: 'Ranking de compradores (lead time médio)', dimension: 'Comprador', measure: 'Lead time (dias)', agg: 'mean', format: 'number', size: 'md' }),

    p({ type: 'table', title: 'Fornecedores com mais pedidos em atraso', dimension: 'Fornecedor', agg: 'count', format: 'number', size: 'lg', filterColumn: 'Entregue no prazo', filterValue: 'Não' }),
  ];
}

export function getTemplates(): DashboardTemplate[] {
  return [
    {
      key: 'compras',
      name: 'Carteira de Compras',
      description: 'SCs em aberto, criticidade, lead time por comprador, OTIF dos críticos e fornecedores em atraso.',
      rows: comprasRows(),
      panels: comprasPanels(),
    },
    {
      key: 'logistica',
      name: 'Logística',
      description: 'Entregas, OTIF, ocorrências, frete por transportadora e tempo de ciclo.',
      rows: logisticaRows(),
      panels: logisticaPanels(),
    },
  ];
}
