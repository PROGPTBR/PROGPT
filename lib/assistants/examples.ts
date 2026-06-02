import type { ProfileParams, ScorecardParams, RfpParams } from './types';

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
