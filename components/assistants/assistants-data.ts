export type AssistantPreviewKey =
  | 'dashboard'
  | 'abc'
  | 'spend'
  | 'porter'
  | 'suppliers'
  | 'kraljic'
  | 'rfp'
  | 'negotiation'
  | 'financial'
  | 'scorecard'
  | 'homologacao'
  | 'pesquisa_precos'
  | 'indicadores'
  | 'simulador_tributario'
  | 'simulador_logistico';

export type AssistantDefinition = {
  id: string;
  step: number;
  stepCategory: string;
  href: string;
  title: string;
  short: string;
  sideSubtitle?: string;
  bullets: readonly string[];
  previewKey: AssistantPreviewKey;

  /**
   * 'em_breve' = recurso em desenvolvimento, sem CTA de contato.
   * 'sob_demanda' = recurso existe mas depende de projeto/contrato
   *   dedicado; CTA vira "Falar com o time" (mailto comercial).
   * Em ambos os casos o card não é clicável no Hub.
   */
  badge?: 'em_breve' | 'sob_demanda';

  /**
   * false = aparece no Hub, mas não aparece
   * no painel lateral de Assistentes.
   *
   * Se não for informado, o padrão é aparecer.
   */
  showInSidePanel?: boolean;
};

export const ASSISTANTS: readonly AssistantDefinition[] = [
  {
    id: 'painel',
    step: 0,
    stepCategory: 'Visão geral',
    href: '/painel',
    title: 'Painel',
    short:
      'Dashboard moderna que reúne TODOS os seus dados num só lugar: conversas, execuções, gasto por categoria, top fornecedores e evolução mensal — atualizado em tempo real, sem planilha nem Power BI.',
    sideSubtitle: 'Visão geral da plataforma',
    bullets: [
      'KPIs e gráficos interativos (SVG, tema claro/escuro)',
      'Gasto por categoria, fornecedor e mês da Análise de Gastos',
      'Atualiza sozinho conforme você usa a plataforma',
    ],
    previewKey: 'dashboard',
    showInSidePanel: false,
  },

  {
    id: 'abc',
    step: 1,
    stepCategory: 'Análise',
    href: '/assistants/abc',
    title: 'Análise ABC',
    short:
      'Classifica spend pela curva de Pareto (80/95%), gera plano de ação por classe A/B/C e curva visual.',
    sideSubtitle: 'Classifique seus gastos por prioridade',
    bullets: [
      'Upload de planilha (XLSX, XLS ou CSV)',
      'Classificação determinística A/B/C',
      '.docx + .xlsx multi-sheet + chart',
    ],
    previewKey: 'abc',
  },

  {
    id: 'spend_analysis',
    step: 1,
    stepCategory: 'Análise',
    href: '/assistants/spend_analysis',
    title: 'Análise de Gastos',
    short:
      'Da nota fiscal à estratégia: sobe um lote de invoices (PDF ou planilha), extrai cada nota, classifica e gera KPIs + plano de strategic sourcing.',
    sideSubtitle: 'Transforme spend em estratégia',
    bullets: [
      'Upload de invoices em PDF + planilha (XLSX/CSV)',
      'Extração por IA: PO, país, moeda, total, prazo, categoria',
      'KPIs + Pareto + strategic sourcing (.xlsx + .docx)',
    ],
    previewKey: 'spend',
  },

  {
    id: 'porter',
    step: 2,
    stepCategory: 'Mercado',
    href: '/assistants/porter',
    title: 'Porter',
    short:
      'Análise das 5 Forças de Porter (1979) para uma categoria, com classificação de intensidade e recomendações.',
    sideSubtitle: 'Analise as forças do mercado',
    bullets: [
      'Rivalidade, entrantes, substitutos, fornecedores, compradores',
      'Intensidade baixa / média / alta por força',
      'Markdown + .docx + chat de refinamento',
    ],
    previewKey: 'porter',
  },

  {
    id: 'suppliers',
    step: 2,
    stepCategory: 'Mercado',
    href: '/assistants/suppliers',
    title: 'Busca de Fornecedores',
    short:
      'Encontre fornecedores reais por CNAE + região. Descreva em linguagem natural; a IA classifica e busca empresas ativas na Receita.',
    sideSubtitle: 'Encontre fornecedores reais',
    bullets: [
      'Classificação automática de CNAE',
      'Filtro por estado e porte',
      'Export CSV pra Excel BR',
    ],
    previewKey: 'suppliers',
  },

  {
    id: 'kraljic',
    step: 3,
    stepCategory: 'Estratégia',
    href: '/assistants/kraljic',
    title: 'Kraljic',
    short:
      'Classifica seu portfólio na Matriz de Kraljic e gera plano de ação por quadrante.',
    sideSubtitle: 'Estratégia para seu portfólio',
    bullets: [
      'Portfólio 2-200 itens',
      'Bubble chart 2×2 + plano',
      '.docx + .xlsx multi-sheet',
    ],
    previewKey: 'kraljic',
  },

  {
    id: 'rfp',
    step: 4,
    stepCategory: 'Engajamento',
    href: '/assistants/rfp',
    title: 'RFP',
    short:
      'Gera draft completo de RFP/RFQ a partir de parâmetros + base de conhecimento.',
    sideSubtitle: 'Crie RFPs e RFQs estruturadas',
    bullets: [
      'Cliente, escopo, prazo, orçamento',
      'Markdown + .docx + .xlsx',
      'Chat de refinamento',
    ],
    previewKey: 'rfp',
  },

  {
    id: 'negotiation',
    step: 5,
    stepCategory: 'Negociação',
    href: '/assistants/negotiation',
    title: 'Simulador de Negociação',
    short:
      'Construtor de estratégia (postura, Kraljic, SWOT, SMART, intel de mercado) + simulador de chat onde a IA personifica o fornecedor.',
    sideSubtitle: 'Prepare e simule negociações',
    bullets: [
      'Form com ZOPA, perfil do fornecedor, objetivo',
      'Estratégia em cards visuais + chat treino',
      'Score 0-100 com 4 dimensões ao encerrar',
    ],
    previewKey: 'negotiation',
  },

  {
    id: 'financial',
    step: 6,
    stepCategory: 'Contrato',
    href: '/assistants/financial',
    title: 'Análise Financeira',
    short:
      'Score determinístico 0-100 da saúde financeira do fornecedor (12 indicadores, 4 pilares ponderados).',
    sideSubtitle: 'Avalie a saúde financeira',
    bullets: [
      'PDF do Balanço/DRE → extração automática',
      'Score Liquidez/Dívida/Margem/ROE (peso 30/30/20/20)',
      'Recomendação buy/caution/do_not_buy + termos de pagamento',
    ],
    previewKey: 'financial',
  },

  {
    id: 'scorecard',
    step: 7,
    stepCategory: 'Gestão de fornecedores',
    href: '/assistants/scorecard',
    title: 'Supplier Scorecard',
    short:
      'Avalia e ranqueia fornecedores por critérios ponderados, com plano de ação por faixa.',
    sideSubtitle: 'Avalie e ranqueie fornecedores',
    bullets: [
      'Critérios editáveis com pesos',
      'Ranking + faixas (Estratégico/Desenvolvimento/Saída)',
      '.docx + .xlsx multi-sheet',
    ],
    previewKey: 'scorecard',
  },

  {
    id: 'homologacao',
    step: 7,
    stepCategory: 'Gestão de fornecedores',
    href: '/assistants/homologacao',
    title: 'Homologação de Fornecedor',
    short:
      'Informe o CNPJ e ele consulta situação cadastral, score de risco, compliance e certidões na Receita — e gera o relatório de homologação.',
    sideSubtitle: 'Consulte risco e compliance',
    bullets: [
      'Consulta CNPJ na Receita (BrasilAPI)',
      'Score de risco + recomendação (aprovar/ressalvas/recusar)',
      'Relatório de homologação em .docx',
    ],
    previewKey: 'homologacao',
    badge: 'sob_demanda',
  },

  {
    id: 'pesquisa_precos',
    step: 8,
    stepCategory: 'Custo e preço',
    href: '/assistants/pesquisa_precos',
    title: 'Pesquisa de Preços',
    short:
      'Descreva os itens e ele busca o preço de referência nas compras públicas (CATMAT / Painel de Preços) — mediana, faixa e fontes.',
    sideSubtitle: 'Pesquise preços de referência',
    bullets: [
      'Preço de referência por item (mediana + faixa p25–p75)',
      'Fonte: compras públicas reais (Painel de Preços)',
      'Mapa de preços em .docx para RFP e negociação',
    ],
    previewKey: 'pesquisa_precos',
  },

  {
    id: 'indicadores',
    step: 9,
    stepCategory: 'Macro',
    href: '/assistants/indicadores',
    title: 'Indicadores Econômicos',
    short:
      'Painel ao vivo do Banco Central (Selic, CDI, IPCA, IGP-M, dólar, euro) com leitura para compras.',
    sideSubtitle: 'Acompanhe indicadores econômicos',
    bullets: [
      'Selic, CDI, IPCA, IGP-M, dólar e euro com gráfico',
      'Leitura macro orientada a custo e reajuste (IA)',
      'Fonte: Banco Central (séries SGS), atualizado diariamente',
    ],
    previewKey: 'indicadores',
  },

  {
    id: 'simulador_tributario',
    step: 9,
    stepCategory: 'Macro',
    href: '/simulador',
    title: 'Simulador Tributário',
    short:
      'Compare o Simples Nacional com o novo modelo da Reforma Tributária (IBS/CBS) e enxergue o impacto no status contábil antes de decidir.',
    sideSubtitle: 'Compare cenários tributários',
    bullets: [
      'Simulação Simples Nacional × Reforma (IBS/CBS)',
      'Consulta de CNPJ para preencher os dados',
      'Comparativo de carga e status contábil',
    ],
    previewKey: 'simulador_tributario',
    badge: 'em_breve',
  },

  {
    id: 'simulador_logistico',
    step: 9,
    stepCategory: 'Macro',
    href: '/simulador-logistico',
    title: 'Simulador Logístico (DIFAL)',
    short:
      'Simule o custo logístico de uma operação interestadual com a análise do DIFAL (diferencial de alíquota do ICMS) para decidir a melhor origem de compra.',
    sideSubtitle: 'Simule custos logísticos e DIFAL',
    bullets: [
      'Cálculo do DIFAL por UF de origem × destino',
      'Custo logístico + frete na comparação',
      'Melhor cenário de compra interestadual',
    ],
    previewKey: 'simulador_logistico',
    badge: 'em_breve',
  },
];