import type { PorterForce } from './types';

// Sub-projeto 29 v2 — As 35 afirmações canônicas das 5 Forças de Porter,
// traduzidas e adaptadas do template Procurement Garage 2026
// ("2 Porter + Pestal 11 English.xlsm", aba "5 FORCES").
//
// Pra cada afirmação o usuário atribui:
//   - peso (0-3) = relevância dela neste setor:
//       0 = não se aplica
//       1 = menos relevante que as demais
//       2 = relevante
//       3 = mais relevante que as demais
//   - nota  (1-5) = quão verdadeira ela é hoje:
//       1 = absolutamente falsa
//       2 = falsa, mas pode ser verdadeira sob certas condições
//       3 = parcialmente falsa, parcialmente verdadeira
//       4 = correta, mas pode ser falsa sob certas condições
//       5 = completamente correta
//
// Maior nota ponderada na força = força mais intensa contra o comprador.
// Média geral das 5 forças = atratividade estrutural (alta = setor difícil).

export type PorterStatement = {
  id: string; // stable identifier, e.g. 'S1-1', 'S2-3'
  force: PorterForce;
  text: string;
};

export const PORTER_STATEMENTS: PorterStatement[] = [
  // ── Força 1: Poder de Barganha dos Fornecedores (7) ──────────────
  {
    id: 'S1-1',
    force: 'poder-fornecedor',
    text: 'O fornecimento dos produtos, insumos e serviços necessários está concentrado em poucas mãos.',
  },
  {
    id: 'S1-2',
    force: 'poder-fornecedor',
    text: 'Produtos/serviços comprados pelas empresas existentes não são facilmente substituíveis.',
  },
  {
    id: 'S1-3',
    force: 'poder-fornecedor',
    text: 'As empresas existentes no negócio não são clientes importantes para os fornecedores.',
  },
  {
    id: 'S1-4',
    force: 'poder-fornecedor',
    text: 'Materiais/serviços comprados dos fornecedores são importantes para o sucesso do negócio.',
  },
  {
    id: 'S1-5',
    force: 'poder-fornecedor',
    text: 'Produtos comprados dos fornecedores são diferenciados.',
  },
  {
    id: 'S1-6',
    force: 'poder-fornecedor',
    text: 'Há custos significativos para trocar de fornecedor.',
  },
  {
    id: 'S1-7',
    force: 'poder-fornecedor',
    text: 'Ameaça permanente dos fornecedores entrarem no negócio do setor (integração para frente).',
  },

  // ── Força 2: Poder de Barganha dos Compradores (8) ───────────────
  {
    id: 'S2-1',
    force: 'poder-comprador',
    text: 'Clientes compram em grandes quantidades e estão sempre sob pressão para reduzir preços.',
  },
  {
    id: 'S2-2',
    force: 'poder-comprador',
    text: 'Produto/serviço vendido pela empresa representa parcela significativa do custo do cliente.',
  },
  {
    id: 'S2-3',
    force: 'poder-comprador',
    text: 'Produtos/serviços que os clientes compram são padronizados.',
  },
  {
    id: 'S2-4',
    force: 'poder-comprador',
    text: 'Clientes não incorrem em custos adicionais significativos para trocar de fornecedor.',
  },
  {
    id: 'S2-5',
    force: 'poder-comprador',
    text: 'Há ameaça permanente dos clientes passarem a produzir o produto/serviço internamente (integração para trás).',
  },
  {
    id: 'S2-6',
    force: 'poder-comprador',
    text: 'Produto/serviço vendido pela empresa existente não é essencial para o negócio do cliente.',
  },
  {
    id: 'S2-7',
    force: 'poder-comprador',
    text: 'Clientes conhecem bem os preços e custos do setor.',
  },
  {
    id: 'S2-8',
    force: 'poder-comprador',
    text: 'Clientes operam com margens de lucro apertadas.',
  },

  // ── Força 3: Ameaça de Novos Entrantes (10) ──────────────────────
  {
    id: 'S3-1',
    force: 'novos-entrantes',
    text: 'É possível entrar no negócio sendo pequeno (não há barreira de escala).',
  },
  {
    id: 'S3-2',
    force: 'novos-entrantes',
    text: 'Empresas concorrentes têm marcas desconhecidas ou clientes não são fiéis.',
  },
  {
    id: 'S3-3',
    force: 'novos-entrantes',
    text: 'Baixo investimento exigido em infraestrutura, crédito ao cliente e estoque.',
  },
  {
    id: 'S3-4',
    force: 'novos-entrantes',
    text: 'Clientes terão baixo custo para trocar do fornecedor atual para um novo entrante.',
  },
  {
    id: 'S3-5',
    force: 'novos-entrantes',
    text: 'Tecnologia dos concorrentes não é patenteada. Não exige investimento em pesquisa.',
  },
  {
    id: 'S3-6',
    force: 'novos-entrantes',
    text: 'A localização, compatível com a concorrência, exigirá investimento pequeno.',
  },
  {
    id: 'S3-7',
    force: 'novos-entrantes',
    text: 'Não há exigências governamentais que beneficiem empresas existentes.',
  },
  {
    id: 'S3-8',
    force: 'novos-entrantes',
    text: 'Empresas estabelecidas têm pouca experiência ou custos operacionais altos.',
  },
  {
    id: 'S3-9',
    force: 'novos-entrantes',
    text: 'Guerra contra novos competidores é improvável (sem retaliação esperada).',
  },
  {
    id: 'S3-10',
    force: 'novos-entrantes',
    text: 'O mercado não está saturado.',
  },

  // ── Força 4: Ameaça de Produtos Substitutos (4) ──────────────────
  {
    id: 'S4-1',
    force: 'substitutos',
    text: 'Há grande quantidade de produtos/serviços substitutos disponíveis.',
  },
  {
    id: 'S4-2',
    force: 'substitutos',
    text: 'Produtos/serviços substitutos têm custos menores que os existentes.',
  },
  {
    id: 'S4-3',
    force: 'substitutos',
    text: 'Empresas existentes geralmente não usam publicidade/comunicação ativa para promover a marca.',
  },
  {
    id: 'S4-4',
    force: 'substitutos',
    text: 'Setores de produtos/serviços substitutos estão expandindo, aumentando a percepção de opções.',
  },

  // ── Força 5: Rivalidade entre Concorrentes Existentes (6) ────────
  {
    id: 'S5-1',
    force: 'rivalidade',
    text: 'Há grande número de competidores, com equilíbrio relativo entre eles.',
  },
  {
    id: 'S5-2',
    force: 'rivalidade',
    text: 'O setor mostra crescimento lento.',
  },
  {
    id: 'S5-3',
    force: 'rivalidade',
    text: 'Altos custos fixos e pressão para vender o máximo possível para diluí-los.',
  },
  {
    id: 'S5-4',
    force: 'rivalidade',
    text: 'Disputa de preço acirrada entre competidores.',
  },
  {
    id: 'S5-5',
    force: 'rivalidade',
    text: 'Não há diferenciação entre os produtos/serviços comercializados.',
  },
  {
    id: 'S5-6',
    force: 'rivalidade',
    text: 'É muito caro para empresas estabelecidas saírem do negócio (altas barreiras de saída).',
  },
];

// Convenience: statements grouped by force, used by the form to render
// section-by-section.
export const PORTER_STATEMENTS_BY_FORCE: Record<
  PorterForce,
  PorterStatement[]
> = {
  'poder-fornecedor': PORTER_STATEMENTS.filter(
    (s) => s.force === 'poder-fornecedor',
  ),
  'poder-comprador': PORTER_STATEMENTS.filter(
    (s) => s.force === 'poder-comprador',
  ),
  'novos-entrantes': PORTER_STATEMENTS.filter(
    (s) => s.force === 'novos-entrantes',
  ),
  substitutos: PORTER_STATEMENTS.filter((s) => s.force === 'substitutos'),
  rivalidade: PORTER_STATEMENTS.filter((s) => s.force === 'rivalidade'),
};

// Force render order matches Porter (1979) and the PG template:
export const PORTER_FORCES_ORDERED: PorterForce[] = [
  'poder-fornecedor',
  'poder-comprador',
  'novos-entrantes',
  'substitutos',
  'rivalidade',
];

// Intensity bucketing for the weighted-average per force (range 1..5).
// Mirrors the PG template's visual conventions: <2 fraco, 2-3.5 médio,
// >=3.5 forte.
export type PorterIntensity = 'baixa' | 'media' | 'alta';

export function intensityFromScore(score: number): PorterIntensity {
  if (score < 2) return 'baixa';
  if (score < 3.5) return 'media';
  return 'alta';
}

export const PORTER_INTENSITY_LABELS: Record<PorterIntensity, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};
