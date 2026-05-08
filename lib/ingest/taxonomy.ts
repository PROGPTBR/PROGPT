export const TAXONOMY = [
  'Kraljic',
  'Sourcing Estratégico',
  'SRM',
  'TCO',
  'Sustentabilidade',
  'Risco / Resiliência',
  'Negociação / Contratos',
  'Performance / KPIs',
  'Digital / Tecnologia',
  'Setor Público',
  'Outros',
] as const;

export type Theme = (typeof TAXONOMY)[number];

export function isValidTheme(s: string): s is Theme {
  return (TAXONOMY as readonly string[]).includes(s);
}

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  'Kraljic': 'Matriz de Kraljic, categorização de itens, portfolio de compras',
  'Sourcing Estratégico': 'Strategic sourcing, seleção de fornecedores, RFx',
  'SRM': 'Supplier Relationship Management, gestão de fornecedores',
  'TCO': 'Total Cost of Ownership, custo total, análise de custo-benefício',
  'Sustentabilidade': 'Compras sustentáveis, ESG, ISO 20400/26000, circularidade',
  'Risco / Resiliência': 'Risco da cadeia, resiliência, contingência, disruptions',
  'Negociação / Contratos': 'Técnicas de negociação, gestão contratual, SLA',
  'Performance / KPIs': 'Indicadores de compras, savings, métricas de procurement',
  'Digital / Tecnologia': 'P2P, e-procurement, IA, automação, plataformas digitais',
  'Setor Público': 'Compras públicas, licitação, lei 14.133, transparência',
  'Outros': 'Não se encaixa nas demais categorias OU artigo de procurement geral',
};
