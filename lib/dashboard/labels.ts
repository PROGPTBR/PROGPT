// Rótulos amigáveis por tipo de assistente, usados no Painel unificado.
// Fonte do union: lib/assistants/types.ts (AssistantType). Tipos desconhecidos
// caem no próprio valor cru (defensivo — assistant_runs.assistant_type é text
// livre, sem CHECK).

export const ASSISTANT_LABELS: Record<string, string> = {
  rfp: 'RFP',
  kraljic: 'Kraljic',
  porter: 'Porter',
  financial: 'Análise Financeira',
  abc: 'Curva ABC',
  profile: 'Perfil de Categoria',
  negotiation: 'Negociação',
  scorecard: 'Supplier Scorecard',
  homologacao: 'Homologação',
  pesquisa_precos: 'Pesquisa de Preços',
  spend_analysis: 'Análise de Gastos',
};

export function assistantLabel(type: string): string {
  return ASSISTANT_LABELS[type] ?? type;
}
