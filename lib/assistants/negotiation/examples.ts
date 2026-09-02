import type { NegotiationStrategyParams, NegotiationSimulatorSetup } from '@/lib/assistants/types';

// Sub-projeto 22 — exemplos do botão "✨ Gerar Exemplo".
//
// Tela 1 do Deal Sim tem um botão que preenche o form com um caso real
// (no print original era Amazon Web Services). Pra evitar custo de LLM
// chamada e dar UX instantâneo, mantemos cases pre-curados aqui — o LLM
// até pode gerar outros via /api/assistants/negotiation/example mas o
// fallback estável é esta lista.

export type StrategyExample = {
  id: string;
  label: string;
  params: NegotiationStrategyParams;
};

export const STRATEGY_EXAMPLES: StrategyExample[] = [
  {
    id: 'aws-cloud',
    label: 'AWS — Renegociação de cloud (estratégico)',
    params: {
      supplierName: 'Amazon Web Services',
      category: 'Infraestrutura de Cloud / IaaS',
      supplierWebsite: 'aws.amazon.com',
      annualSpend: 'R$ 4.500.000',
      supplierShare: '70%',
      marketPosition: 'lider',
      kraljicQuadrant: 'estrategico',
      currentPrice: 'R$ 4.500.000/ano',
      supplierDesiredPrice: 'R$ 4.800.000/ano (reajuste 6,7%)',
      targetPrice: 'R$ 3.800.000/ano (redução 15,5%)',
      walkawayPrice: 'R$ 4.200.000/ano (manter nominal)',
      strategicObjective: 'reducao-custos',
      contractStatus:
        'Contrato expira em 6 meses. Relacionamento bom, mas preços ~10% acima do mercado em alguns SKUs (S3, EC2 reservadas).',
      priceScenario:
        'Reduzir o spend anual de R$ 4,5MM para R$ 3,8MM via Enterprise Discount Program (compromisso de 3 anos) + migração para Graviton 5 + reotimização de tiers S3.',
      // SWOT do comprador (Batch H) — exemplo serve também de discovery do
      // campo: mostra a granularidade esperada (frases curtas e concretas).
      swotInput: {
        strengths:
          'Volume relevante e previsível; contrato de 3 anos é atrativo para o vendedor; time interno domina FinOps.',
        weaknesses:
          'Migração de saída levaria 12+ meses; dependência de serviços gerenciados proprietários.',
        opportunities:
          'Concorrência agressiva de Azure e GCP em contratos enterprise; Graviton reduz custo por vCPU.',
        threats:
          'Reajuste anual indexado ao câmbio; lock-in aumenta a cada novo serviço adotado.',
      },
    },
  },
  {
    id: 'aco-commodity',
    label: 'Aço plano — Commodity industrial (alavancável)',
    params: {
      supplierName: 'Gerdau S.A.',
      category: 'Aço plano laminado a frio',
      supplierWebsite: 'gerdau.com.br',
      annualSpend: 'R$ 12.000.000',
      supplierShare: '40%',
      marketPosition: 'lider',
      kraljicQuadrant: 'alavancavel',
      currentPrice: 'R$ 5,80/kg',
      supplierDesiredPrice: 'R$ 5,95/kg (reajuste IPCA)',
      targetPrice: 'R$ 5,40/kg',
      walkawayPrice: 'R$ 5,70/kg',
      strategicObjective: 'reducao-custos',
      contractStatus:
        'Contrato anual, renovação automática. Fornecedor #2 (CSN) com share 30% e fornecedor #3 (ArcelorMittal) com 30%.',
      priceScenario:
        'Aproveitar a queda recente do minério no mercado internacional pra capturar 6-8% de redução. Volume firme: 200t/mês.',
    },
  },
  {
    id: 'facilities-servico',
    label: 'Facilities — Serviço recorrente (não-crítico)',
    params: {
      supplierName: 'GR Serviços e Alimentação',
      category: 'Serviços de copa e cafeteria corporativa',
      supplierWebsite: 'gr.com.br',
      annualSpend: 'R$ 600.000',
      supplierShare: '100%',
      marketPosition: 'desafiante',
      kraljicQuadrant: 'nao-critico',
      currentPrice: 'R$ 50.000/mês',
      supplierDesiredPrice: 'R$ 53.000/mês (reajuste 6%)',
      targetPrice: 'R$ 47.000/mês',
      walkawayPrice: 'R$ 50.000/mês (manter)',
      strategicObjective: 'reducao-custos',
      contractStatus:
        'Contrato em vigor há 4 anos. Satisfação dos colaboradores baixa-média (NPS 38). Mercado tem 5+ fornecedores qualificados.',
      priceScenario:
        'Renovar com redução de 6% via consolidação de cardápio e ajuste de SLA. Alternativa: cotar com 3 concorrentes pra benchmark.',
    },
  },
  {
    id: 'sap-single-source',
    label: 'SAP — ERP single-source (gargalo)',
    params: {
      supplierName: 'SAP Brasil',
      category: 'Licenças e suporte ERP (S/4HANA)',
      supplierWebsite: 'sap.com/brazil',
      annualSpend: 'R$ 2.400.000',
      supplierShare: '100%',
      marketPosition: 'lider',
      kraljicQuadrant: 'gargalo',
      currentPrice: 'R$ 200.000/mês',
      supplierDesiredPrice: 'R$ 215.000/mês (reajuste IGP-M)',
      targetPrice: 'R$ 190.000/mês',
      walkawayPrice: 'R$ 210.000/mês',
      strategicObjective: 'redução-risco',
      contractStatus:
        'Migração pra outro ERP custaria R$ 8-12MM e levaria 18-24 meses. Lock-in técnico alto. Suporte crítico pra operação fiscal BR.',
      priceScenario:
        'Travar 3 anos com reajuste limitado ao IPCA + benefício de licença adicional sem custo (módulo SuccessFactors).',
    },
  },
  {
    id: 'consultoria-internacional',
    label: 'Consultoria estratégica internacional',
    params: {
      supplierName: 'McKinsey & Company',
      category: 'Consultoria estratégica',
      supplierWebsite: 'mckinsey.com',
      annualSpend: 'R$ 3.000.000',
      supplierShare: '60%',
      marketPosition: 'lider',
      kraljicQuadrant: 'estrategico',
      currentPrice: 'R$ 250.000/mês (engajamento ativo)',
      supplierDesiredPrice: 'R$ 280.000/mês',
      targetPrice: 'R$ 220.000/mês',
      walkawayPrice: 'R$ 260.000/mês',
      strategicObjective: 'aumento-qualidade',
      contractStatus:
        'Engajamento de transformação iniciado há 8 meses, fase 2 começando. Time mid-senior +1 partner. BCG e Bain como alternativas (qualidade similar).',
      priceScenario:
        'Reestruturar como retainer fix + success fee (10% upside no saving capturado). Reduz risco do comprador e dá upside ao fornecedor.',
    },
  },
  {
    id: 'plastpack-embalagens',
    label: 'PlastPack Embalagens — Renovação de contrato (alavancável)',
    params: {
      supplierName: 'PlastPack Embalagens',
      category: 'Embalagens plásticas e papelão',
      supplierWebsite: '',
      annualSpend: 'R$ 8.500.000',
      supplierShare: '',
      marketPosition: 'seguidor',
      kraljicQuadrant: 'alavancavel',
      currentPrice: 'R$ 8.500.000/ano',
      supplierDesiredPrice: 'R$ 8.500.000/ano (manutenção do valor atual)',
      targetPrice: 'R$ 7.900.000/ano',
      walkawayPrice:
        'R$ 8.100.000/ano (piso sinalizado pelo fornecedor em condições normais)',
      strategicObjective: 'reducao-custos',
      contractStatus:
        'Contrato vigente com fornecedor único da linha. Ele resiste a descontos acima de ~4,7% sobre o valor atual, mas o preço da resina plástica caiu recentemente no mercado.',
      priceScenario:
        'Queda recente da resina plástica abre espaço pra negociar desconto sobre o contrato atual. Ancorar próximo ao piso sinalizado pelo fornecedor (R$ 8,1MM) sem pressionar prazo de pagamento acima de 90 dias, volume abaixo de 40% da demanda dele, SLAs sem tolerância mútua, ou congelamento de preço sem indexador.',
      mustHaves:
        'Prazo de pagamento de até 90 dias; volume contratado igual ou acima de 40% da demanda do fornecedor; SLA com cláusula de tolerância mútua; mecanismo de revisão caso resina ou papelão oscilem acima de 10%.',
      purchaseType: 'contrato',
      negotiationTechnique: 'planejamento',
    },
  },
];

// Exemplos pro setup do simulator (Tela 6).
export type SimulatorSetupExample = {
  id: string;
  label: string;
  setup: NegotiationSimulatorSetup;
};

export const SIMULATOR_SETUP_EXAMPLES: SimulatorSetupExample[] = [
  {
    id: 'aws-aggressive',
    label: 'AWS — Account Manager agressivo',
    setup: {
      personaProfile: 'agressivo',
      supplierObjectives:
        'Manter share de 70%+ na conta. Pressionar adoção de Bedrock + Sagemaker (margem maior). Resistir a descontos de volume além de 12% mesmo com EDP.',
      supplierWalkaway:
        'Não pode oferecer mais de 15% de desconto agregado sem aprovação regional. Não pode comprometer SLA premium. Mínimo de 36 meses de compromisso pra qualquer desconto significativo.',
    },
  },
  {
    id: 'gerdau-relacional',
    label: 'Gerdau — Comercial relacional',
    setup: {
      personaProfile: 'relacional',
      supplierObjectives:
        'Manter relacionamento de 10+ anos. Capturar pelo menos reajuste IPCA. Aceita pequenos descontos em troca de extensão de prazo e crescimento de volume previsível.',
      supplierWalkaway:
        'Margem líquida da conta não pode ficar abaixo de 8%. Não pode dar mais de 5% de desconto sem volume garantido extra. Prazo de pagamento mínimo 30 dias.',
    },
  },
  {
    id: 'sap-rigido',
    label: 'SAP — Sales Engineer rígido',
    setup: {
      personaProfile: 'rigido',
      supplierObjectives:
        'Aplicar reajuste IGP-M conforme contrato master. Empurrar módulos adicionais (Ariba, Concur). Não negociar termos de cancelamento.',
      supplierWalkaway:
        'Reajuste mínimo IPCA. Não há flexibilidade no preço de lista; só via inclusão de produtos novos no escopo. Suporte premium 24x7 é não-negociável.',
    },
  },
  {
    id: 'plastpack-pragmatico',
    label: 'PlastPack — Comercial pragmático',
    setup: {
      personaProfile: 'pragmatico',
      supplierObjectives:
        'Preservar a margem de contribuição da conta sem perder o volume atual. Aceita ceder no preço se o comprador garantir volume e prazo, evitando repasse total de custo sem indexador.',
      supplierWalkaway:
        'Ponto de Saída Absoluto (Walk-Away Price): R$ 7.750.000 — abaixo deste valor a operação passa a queimar margem de contribuição direta, inviabilizando os custos fixos da planta. Preço Mínimo Aceitável em condições normais: R$ 8.100.000 (desconto de ~4,7% sobre o valor atual, preservando margem operacional diante da queda da resina plástica). Fatores não financeiros que também disparam a saída do vendedor: (1) Prazo de pagamento acima de 90 dias sem compensação em taxa financeira ou volume adicional; (2) Redução do volume contratado para menos de 40% da demanda total da empresa, o que tira a prioridade da conta na linha produtiva; (3) Penalidades e SLAs inflexíveis — multas severas por atrasos causados por volatilidade externa de matéria-prima, sem cláusula de tolerância mútua; (4) Repasse total de custos sem indexador — congelamento estrito de preços sem mecanismo de revisão caso resina e papelão oscilem acima de 10%.',
    },
  },
];

// "Deals" nomeados — permitem forçar um caso específico via query param
// (?deal=plastpack). Usado pelo default abaixo e por links de demo.
export const DEMO_SCENARIOS: Record<
  string,
  { strategyId: string; setupId: string }
> = {
  plastpack: {
    strategyId: 'plastpack-embalagens',
    setupId: 'plastpack-pragmatico',
  },
};

// Decisão do dono do produto (2026-09-01, véspera da apresentação pro
// cliente): o botão "Gerar Exemplo" passa a devolver SEMPRE a PlastPack por
// padrão — não é mais sorteio. Os outros 5 casos continuam na lista (e o
// sorteio de verdade continua acessível via `?deal=` com um valor que não
// exista em DEMO_SCENARIOS, ex. `?deal=sorteio`) até decidirem voltar a
// variar o padrão.
const DEFAULT_DEAL = 'plastpack';

/** Resolve o exemplo a devolver pro botão "Gerar Exemplo". Sem `deal` (ou
 * com um `deal` que bate em DEMO_SCENARIOS), devolve sempre o cenário
 * default combinado — um `deal` desconhecido cai no sorteio entre todos os
 * casos cadastrados. */
export function pickExample(
  kind: 'strategy' | 'setup',
  deal?: string | null,
): StrategyExample | SimulatorSetupExample | undefined {
  const list = kind === 'setup' ? SIMULATOR_SETUP_EXAMPLES : STRATEGY_EXAMPLES;
  const effectiveDeal = deal ?? DEFAULT_DEAL;

  if (effectiveDeal) {
    const scenario = DEMO_SCENARIOS[effectiveDeal];
    const id =
      scenario && (kind === 'setup' ? scenario.setupId : scenario.strategyId);
    const found = id ? list.find((e) => e.id === id) : undefined;
    if (found) return found;
  }

  return list[Math.floor(Math.random() * list.length)];
}
