import type { NegotiationStrategyResult, NegotiationStrategyParams } from '@/lib/assistants/types';
import {
  KRALJIC_QUADRANT_LABELS,
  SUPPLIER_MARKET_POSITION_LABELS,
  NEGOTIATION_OBJECTIVE_LABELS,
} from '@/lib/assistants/types';

// Serializa o JSON da estratégia em markdown legível pra:
//   1. assistant_runs.output_md (campo histórico — pesquisável)
//   2. Geração do .docx via mdToDocxBuffer (download "Visualizar Estratégia
//      Completa" + transcript final inclui a estratégia em anexo)
//
// Mantemos paralelismo visual com o que aparece na UI (Tela 3-5 do Deal
// Sim): banner de postura, cards de bargaining + Kraljic, intel, sumário,
// SWOT, SMART.

const POWER_LABEL: Record<'low' | 'med' | 'high', string> = {
  low: 'Baixo',
  med: 'Médio',
  high: 'Alto',
};

export function strategyToMarkdown(
  params: NegotiationStrategyParams,
  result: NegotiationStrategyResult,
): string {
  const lines: string[] = [];

  lines.push(`# Estratégia de Negociação — ${params.supplierName}`);
  lines.push('');
  lines.push(
    `**Categoria:** ${params.category}${params.supplierWebsite ? ` · **Referência:** ${params.supplierWebsite}` : ''}`,
  );
  if (params.annualSpend || params.supplierShare) {
    const bits: string[] = [];
    if (params.annualSpend) bits.push(`Spend ${params.annualSpend}`);
    if (params.supplierShare) bits.push(`Share ${params.supplierShare}`);
    lines.push(`**Contexto:** ${bits.join(' · ')}`);
  }
  if (params.marketPosition) {
    lines.push(
      `**Posição no mercado:** ${SUPPLIER_MARKET_POSITION_LABELS[params.marketPosition]}`,
    );
  }
  if (params.strategicObjective) {
    lines.push(
      `**Objetivo estratégico:** ${NEGOTIATION_OBJECTIVE_LABELS[params.strategicObjective]}`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // Recomendação Final (Banner)
  lines.push(`## Recomendação Final`);
  lines.push('');
  lines.push(`### ${result.posture.label}`);
  lines.push('');
  lines.push(`> ${result.posture.paragraph.split('\n').join('\n> ')}`);
  lines.push('');

  // Poder de Barganha
  lines.push(`## Poder de Barganha`);
  lines.push('');
  lines.push(
    `- **Comprador:** ${POWER_LABEL[result.bargainingPower.buyer]}`,
  );
  lines.push(
    `- **Fornecedor:** ${POWER_LABEL[result.bargainingPower.supplier]}`,
  );
  lines.push('');

  // Quadrante Kraljic
  lines.push(`## Quadrante Kraljic — ${result.kraljic.label}`);
  lines.push('');
  lines.push(result.kraljic.explanation);
  lines.push('');

  // Inteligência de Mercado
  lines.push(`## Inteligência de Mercado`);
  lines.push('');
  lines.push(`### Notícias Recentes`);
  lines.push('');
  lines.push(result.marketIntel.news);
  lines.push('');
  lines.push(`### Resultados Financeiros e Fusões/Aquisições`);
  lines.push('');
  lines.push(result.marketIntel.financials);
  lines.push('');
  lines.push(`### Inovações Recentes`);
  lines.push('');
  lines.push(result.marketIntel.innovations);
  lines.push('');
  lines.push(`### Riscos Identificados`);
  lines.push('');
  lines.push(result.marketIntel.risks);
  lines.push('');
  lines.push(`### Sustentabilidade`);
  lines.push('');
  lines.push(result.marketIntel.sustainability);
  lines.push('');

  // Sumário Executivo
  lines.push(`## Sumário Executivo`);
  lines.push('');
  lines.push(result.executiveSummary);
  lines.push('');

  // SWOT
  lines.push(`## Análise SWOT`);
  lines.push('');
  lines.push(`### Forças`);
  for (const b of result.swot.strengths) lines.push(`- ${b}`);
  lines.push('');
  lines.push(`### Fraquezas`);
  for (const b of result.swot.weaknesses) lines.push(`- ${b}`);
  lines.push('');
  lines.push(`### Oportunidades`);
  for (const b of result.swot.opportunities) lines.push(`- ${b}`);
  lines.push('');
  lines.push(`### Ameaças`);
  for (const b of result.swot.threats) lines.push(`- ${b}`);
  lines.push('');

  // Metas SMART
  lines.push(`## Metas SMART da Missão`);
  lines.push('');
  lines.push(`**S — Específico:** ${result.smartGoals.specific}`);
  lines.push('');
  lines.push(`**M — Mensurável:** ${result.smartGoals.measurable}`);
  lines.push('');
  lines.push(`**A — Atingível:** ${result.smartGoals.achievable}`);
  lines.push('');
  lines.push(`**R — Relevante:** ${result.smartGoals.relevant}`);
  lines.push('');
  lines.push(`**T — Temporal:** ${result.smartGoals.temporal}`);
  lines.push('');

  // Kraljic do user (input — pra rastreabilidade)
  if (params.kraljicQuadrant) {
    lines.push('---');
    lines.push('');
    lines.push(
      `_Input do usuário — Kraljic inicial:_ ${KRALJIC_QUADRANT_LABELS[params.kraljicQuadrant]}`,
    );
  }

  return lines.join('\n');
}
