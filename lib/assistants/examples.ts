import type {
  ProfileParams,
  ScorecardParams,
  RfpParams,
  KraljicParams,
  AbcParams,
  FinancialParams,
  PorterParams,
  HomologacaoParams,
  PesquisaPrecosParams,
} from './types';
import { PORTER_STATEMENTS } from './porter-statements';

// Item 4 (ativação) — exemplos "carregar exemplo" pros forms mais pesados
// (Profile, Scorecard, RFP). Reduz fricção: o usuário vê como é um bom input
// e gera o artefato em 1 clique. Tema único e coerente: Embalagens Flexíveis.
// Nomes de fornecedores são FICTÍCIOS de propósito (exemplo/demo).
//
// Cada `params` é validado contra o zod schema correspondente em
// tests/lib/assistants/examples.test.ts — se um campo divergir, o teste quebra.

export type FormExample<T> = { id: string; label: string; params: T };

export const PROFILE_EXAMPLES: FormExample<ProfileParams>[] = [
  {
    id: 'embalagens-flexiveis',
    label: 'Embalagens Flexíveis',
    params: {
      nomeCategoria: 'Embalagens Flexíveis',
      descricao:
        'Filmes e estruturas de embalagem flexível (mono e multicamada, laminados e coextrudados) para alimentos, bebidas e higiene. Inclui estruturas com barreira a oxigênio e umidade, BOPP, BOPE e BOPET.',
      subSegmentos: [
        'Filmes laminados PE/PE',
        'Coextrudados com barreira',
        'Estruturas BOPP/BOPE',
        'Laminados OPP/PE',
      ],
      escopoIncluido:
        'Filmes em bobinas até 1.500 mm de largura, espessura 12–80 µm, tolerância dimensional ±2%. Serviços de slitting e rebobinamento customizados. Entrega CIF ou DDP conforme negociação.',
      escopoNaoIncluido:
        'Estruturas laminadas com papel kraft ou alumínio (categoria "composta"), bolsas pré-confeccionadas e seladas, e filmes com tratamento plasma especial.',
      spendAnualBRL: 8500000,
      volumeFisico: '450 ton/ano',
      numeroFornecedoresAtivos: 6,
      sazonalidade: 'Pico no Q4 (abastecimento de fim de ano); vale no Q1. Variabilidade ±15% YoY.',
      requisitosTecnicos:
        'Conformidade ABNT NBR 14937 e teste de vedação (força mínima 10 N/15 mm em filmes 2 camadas). Certificações ISO 9001:2015 e ISO 14001:2015. Rastreabilidade de lote obrigatória no rótulo e na documentação de acompanhamento.',
      restricoesRegulatorias:
        'ANVISA RDC 91/2001 (polímeros em contato com alimentos) e RDC 42/2008 (aditivos). Lei 12.305/2010 (resíduos sólidos). Itens importados da UE devem atender ao Regulamento (CE) 10/2011.',
      criteriosAvaliacao: [
        'Qualidade consistente e conformidade a normas',
        'Preço competitivo (R$/ton)',
        'Prazo de entrega (lead time < 45 dias)',
        'Serviços de customização (slitting, tratamentos)',
        'Sustentabilidade / pegada de carbono',
        'Inovação em barreiras',
      ],
      stakeholders: [
        { nome: 'Comprador — Categoria Embalagem', papel: 'usuario' },
        { nome: 'Diretor de Supply Chain', papel: 'aprovador' },
        { nome: 'Gerente de Produção', papel: 'operacao' },
        { nome: 'Especialista em Sustentabilidade', papel: 'usuario' },
      ],
      prioridadeEstrategica: 'qualidade',
      observacoes:
        'Categoria crítica para toda a linha de alimentos. Fornecedor ideal combina escala, proximidade logística (SP/SC) e capacidade de inovação em barreiras de oxigênio e umidade.',
    },
  },
];

export const SCORECARD_EXAMPLES: FormExample<ScorecardParams>[] = [
  {
    id: 'embalagens-flexiveis-fornecedores',
    label: 'Embalagens Flexíveis — fornecedores',
    params: {
      scorecardName: 'Avaliação de Fornecedores — Embalagens Flexíveis 2026',
      period: 'Q2–Q3 2026',
      notes:
        'Avaliação trimestral dos 6 fornecedores ativos de filmes laminados e coextrudados. Pesos refletem estratégia de redução de risco via diversificação e inovação em barreiras.',
      criteria: [
        { id: 'qualidade', label: 'Qualidade & Conformidade', weight: 30 },
        { id: 'prazo', label: 'Prazo de Entrega', weight: 15 },
        { id: 'preco', label: 'Preço / Competitividade', weight: 25 },
        { id: 'sustentabilidade', label: 'Sustentabilidade / ESG', weight: 20 },
        { id: 'inovacao', label: 'Inovação em Barreiras', weight: 10 },
      ],
      suppliers: [
        {
          name: 'Polifilm Indústria',
          segment: 'Multinacional — coextrudados',
          scores: { qualidade: 9, prazo: 8, preco: 6, sustentabilidade: 8, inovacao: 7 },
        },
        {
          name: 'BarrierPack Brasil',
          segment: 'Multinacional — estruturas com barreira',
          scores: { qualidade: 8, prazo: 7, preco: 6, sustentabilidade: 9, inovacao: 9 },
        },
        {
          name: 'Laminados Andina',
          segment: 'Nacional — laminados OPP/PE',
          scores: { qualidade: 7, prazo: 9, preco: 8, sustentabilidade: 6, inovacao: 5 },
        },
        {
          name: 'EmbalaSul',
          segment: 'Nacional — filmes laminados',
          scores: { qualidade: 7, prazo: 8, preco: 8, sustentabilidade: 5, inovacao: 4 },
        },
        {
          name: 'FlexFilms Co.',
          segment: 'Multinacional — BOPP biaxial',
          scores: { qualidade: 8, prazo: 7, preco: 5, sustentabilidade: 7, inovacao: 8 },
        },
        {
          name: 'NordPack Soluções',
          segment: 'Multinacional — barreira avançada',
          scores: { qualidade: 9, prazo: 9, preco: 5, sustentabilidade: 9, inovacao: 9 },
        },
      ],
      thresholds: { strategic: 75, development: 55 },
    },
  },
];

export const RFP_EXAMPLES: FormExample<RfpParams>[] = [
  {
    id: 'embalagens-flexiveis-rfp',
    label: 'Embalagens Flexíveis — RFQ',
    params: {
      client: 'Alfa Indústria de Alimentos (exemplo)',
      scope:
        'Filmes de embalagem flexível laminados PE/PE de 25 µm ±2%, para envase de produtos secos. Volume inicial de 200 ton/ano, com cláusula de crescimento de +50% em 2 anos. Bobinas de 1.200 mm, emendas ≤ 2 mm. Serviços inclusos: slitting customizado, teste de vedação, rastreabilidade de lote e documentação. Cronograma: amostras em 20 dias, lote piloto em 60 dias, volume comercial em 90 dias. Planejado: 3 fornecedores na concorrência (diversificação).',
      category: 'Embalagens Flexíveis / Filmes laminados',
      deadline: '30 dias úteis para as propostas',
      budget: 'R$ 800.000–1.200.000/ano (200 ton × R$ 4.500–6.000/ton)',
      criteria: [
        'Qualidade consistente e certificação ISO 9001',
        'Prazo de entrega (amostras < 20 dias, volume < 60 dias)',
        'Preço competitivo com escala de redução',
        'Capacidade de tratamentos especiais (lacre, acabamento)',
        'Sustentabilidade / filme reciclável',
      ],
      notes:
        'Fornecedor ideal combina proximidade logística no Sudeste/Sul, capacidade de inovação em barreiras de umidade e referências no setor de alimentos. A RFQ será analisada em conjunto por Compras, P&D (requisitos técnicos) e Supply (lead times).',
    },
  },
];

export const KRALJIC_EXAMPLES: FormExample<KraljicParams>[] = [
  {
    id: 'embalagens-flexiveis-portfolio',
    label: 'Embalagens Flexíveis — portfólio',
    params: {
      portfolioName: 'Portfólio de Embalagens Flexíveis 2026',
      analysisPeriod: '2026 Q2',
      notes:
        'Mapeamento dos principais insumos da categoria de embalagem flexível para definir estratégia de sourcing por quadrante. Spend em R$ MM/ano.',
      items: [
        // name, segment, category, spendMM, criticality, technicalSpec, customerValue, marketStructure, marketRivalry, supplierPower, supplierSwitching
        { name: 'Resina PE (commodity)', segment: 'Matéria-prima', category: 'Resinas', spendMM: 12, criticality: 2, technicalSpec: 2, customerValue: 2, marketStructure: 2, marketRivalry: 2, supplierPower: 2, supplierSwitching: 2 },
        { name: 'Filme com barreira EVOH', segment: 'Estruturas técnicas', category: 'Filmes', spendMM: 8, criticality: 4, technicalSpec: 4, customerValue: 4, marketStructure: 4, marketRivalry: 3, supplierPower: 4, supplierSwitching: 4 },
        { name: 'Tinta flexográfica especial', segment: 'Insumos de impressão', category: 'Tintas', spendMM: 1.5, criticality: 3, technicalSpec: 4, customerValue: 3, marketStructure: 4, marketRivalry: 2, supplierPower: 4, supplierSwitching: 4 },
        { name: 'Adesivo de laminação', segment: 'Insumos de conversão', category: 'Adesivos', spendMM: 2.2, criticality: 2, technicalSpec: 2, customerValue: 2, marketStructure: 2, marketRivalry: 3, supplierPower: 2, supplierSwitching: 2 },
        { name: 'Bobinas BOPP', segment: 'Substratos', category: 'Filmes', spendMM: 6, criticality: 3, technicalSpec: 3, customerValue: 3, marketStructure: 2, marketRivalry: 3, supplierPower: 3, supplierSwitching: 2 },
        { name: 'Verniz de sobreimpressão', segment: 'Acabamento', category: 'Vernizes', spendMM: 0.4, criticality: 1, technicalSpec: 2, customerValue: 1, marketStructure: 1, marketRivalry: 2, supplierPower: 1, supplierSwitching: 1 },
      ],
    },
  },
];

export const ABC_EXAMPLES: FormExample<AbcParams>[] = [
  {
    id: 'embalagens-flexiveis-spend',
    label: 'Embalagens Flexíveis — spend anual',
    params: {
      analysisName: 'Curva ABC — Insumos de Embalagem Flexível 2026',
      analysisPeriod: 'Ano fiscal 2025',
      notes:
        'Spend anual consolidado dos insumos da categoria de embalagem flexível. Valores em R$ (não MM). Espera-se concentração típica 80/20 nas resinas e filmes.',
      consolidate: true,
      items: [
        { name: 'Resina PE (polietileno)', supplier: 'Polifilm Indústria', category: 'Resinas', quantity: 620, unit: 'ton', spend: 4_200_000 },
        { name: 'Resina PP (polipropileno)', supplier: 'BarrierPack Brasil', category: 'Resinas', quantity: 410, unit: 'ton', spend: 2_800_000 },
        { name: 'Filme com barreira EVOH', supplier: 'NordPack Soluções', category: 'Filmes', quantity: 95, unit: 'ton', spend: 1_600_000 },
        { name: 'Bobinas BOPP', supplier: 'FlexFilms Co.', category: 'Filmes', quantity: 180, unit: 'ton', spend: 1_250_000 },
        { name: 'Tinta flexográfica', supplier: 'Laminados Andina', category: 'Tintas', quantity: 38_000, unit: 'kg', spend: 720_000 },
        { name: 'Adesivo de laminação', supplier: 'EmbalaSul', category: 'Adesivos', quantity: 24_000, unit: 'kg', spend: 540_000 },
        { name: 'Cilindros e clichês', supplier: 'GravaTech', category: 'Ferramental', quantity: 120, unit: 'un', spend: 310_000 },
        { name: 'Verniz de sobreimpressão', supplier: 'Laminados Andina', category: 'Vernizes', quantity: 9_500, unit: 'kg', spend: 180_000 },
        { name: 'Solvente acetato de etila', supplier: 'QuimSul', category: 'Solventes', quantity: 22_000, unit: 'L', spend: 145_000 },
        { name: 'Núcleos de papelão (tubetes)', supplier: 'TuboPack', category: 'Acessórios', quantity: 85_000, unit: 'un', spend: 88_000 },
        { name: 'Fitas e etiquetas', supplier: 'EtiqBrasil', category: 'Acessórios', quantity: 140_000, unit: 'un', spend: 42_000 },
        { name: 'Paletes e filme stretch', supplier: 'LogPack', category: 'Movimentação', quantity: 3_200, unit: 'un', spend: 28_000 },
      ],
    },
  },
];

export const FINANCIAL_EXAMPLES: FormExample<FinancialParams>[] = [
  {
    id: 'fornecedor-embalagens-saudavel',
    label: 'Fornecedor de embalagens — saudável',
    params: {
      supplierName: 'Polifilm Indústria de Embalagens S.A. (exemplo)',
      cnpj: '12.345.678/0001-90',
      referenceYear: '2024',
      observacoes:
        'Fornecedor candidato a contrato anual de filmes laminados (~R$ 1,2 MM/ano). Avaliação de saúde financeira como parte do due diligence pré-contrato.',
      indicators: {
        receitaLiquida: 850,
        ebitda: 145,
        lucroLiquido: 62,
        margemLiquidaPct: 7.3,
        margemEbitdaPct: 17.1,
        dividaLiquidaEbitda: 1.8,
        endividamentoGeralPct: 48,
        liquidezCorrente: 1.6,
        patrimonioLiquido: 410,
        roePct: 15.1,
        roicPct: 12.4,
        fluxoCaixaOperacional: 118,
      },
    },
  },
];

// Perfil de pressão por força para o exemplo de Embalagens Flexíveis:
// fornecedores de resina concentrados (alta), rivalidade entre convertedores
// alta, entrantes barrados por capital (baixa), substitutos moderados,
// compradores (grandes indústrias de alimentos) com bom poder (médio-alto).
const PORTER_FORCE_EXAMPLE_SCORE: Record<string, number> = {
  'poder-fornecedor': 4,
  rivalidade: 4,
  'novos-entrantes': 2,
  substitutos: 3,
  'poder-comprador': 3,
};

export const PORTER_EXAMPLES: FormExample<PorterParams>[] = [
  {
    id: 'embalagens-flexiveis-mercado',
    label: 'Embalagens Flexíveis — mercado',
    params: {
      categoria: 'Embalagens Flexíveis / Filmes laminados',
      segmento: 'Indústria de conversão B2B',
      escopo: 'Brasil, com importações pontuais da América Latina',
      observacoes:
        'Mercado de convertedores de embalagem flexível para alimentos. Matéria-prima (resina) atrelada a petroquímicas concentradas; muitos convertedores de médio porte competindo por escala.',
      statements: PORTER_STATEMENTS.map((s) => ({
        id: s.id,
        weight: 2,
        score: PORTER_FORCE_EXAMPLE_SCORE[s.force] ?? 3,
      })),
    },
  },
];

export const HOMOLOGACAO_EXAMPLES: FormExample<HomologacaoParams>[] = [
  {
    id: 'weg-homologacao',
    label: 'WEG S.A. — homologação',
    params: {
      cnpj: '84.429.695/0001-11',
      fornecedorNome: 'WEG S.A.',
      setor: 'indústria',
      faturamentoAnualBRL: 30000000000,
      notas:
        'Fornecedor candidato a contrato de motores e automação industrial. Homologação como parte do due diligence pré-contrato.',
    },
  },
];

export const PESQUISA_PRECOS_EXAMPLES: FormExample<PesquisaPrecosParams>[] = [
  {
    id: 'materiais-escritorio',
    label: 'Materiais de escritório — preço de referência',
    params: {
      titulo: 'Cesta de materiais de escritório — pesquisa de preços',
      uf: 'SP',
      itens: [
        { descricao: 'Açúcar refinado branco 1kg', unidade: 'kg', quantidade: 500 },
        { descricao: 'Café torrado e moído 500g', unidade: 'pacote', quantidade: 300 },
        { descricao: 'Papel A4 75g resma 500 folhas', unidade: 'resma', quantidade: 200 },
      ],
      notas:
        'Estimativa de preço de referência para abertura de processo de compra; ancorar RFP e meta de negociação.',
    },
  },
];
