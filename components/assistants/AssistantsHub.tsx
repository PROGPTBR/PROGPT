'use client';

import Link from 'next/link';
import {
  FileText,
  Clock,
  History,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';

// Sub-projeto 20+27+28: hub organizada pelos 8 passos do strategic sourcing.
// Cada novo assistente entra no `assistants` do passo correspondente.

type AssistantCard = {
  type: 'rfp' | 'kraljic';
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type SourcingStep = {
  n: number;
  title: string;
  blurb: string;
  assistants: AssistantCard[];
};

const STEPS: SourcingStep[] = [
  {
    n: 1,
    title: 'Perfil da Categoria',
    blurb:
      'Entendimento profundo da categoria, suas especificidades e como ela impacta o negócio.',
    assistants: [],
  },
  {
    n: 2,
    title: 'Análise da Categoria',
    blurb:
      'Coleta e análise de dados internos: volumes, custos, contratos, histórico de fornecimento.',
    assistants: [],
  },
  {
    n: 3,
    title: 'Visão do Mercado Fornecedor',
    blurb:
      'Mapeamento de fornecedores, tendências de mercado, riscos e oportunidades.',
    assistants: [],
  },
  {
    n: 4,
    title: 'Estratégia de Sourcing',
    blurb:
      'Definição de como abordar o mercado — negociação competitiva, parcerias, simplificação ou proteção de fornecimento.',
    assistants: [
      {
        type: 'kraljic',
        href: '/assistants/kraljic',
        title: 'Assistente Kraljic',
        description:
          'Classifica seu portfólio na Matriz de Kraljic (Estratégico / Alavancável / Gargalo / Não Crítico), gera plano de ação por quadrante e gráfico bubble 2×2.',
        icon: LayoutGrid,
      },
    ],
  },
  {
    n: 5,
    title: 'Engajamento dos Fornecedores',
    blurb: 'Condução do processo de RFI, RFP ou RFQ.',
    assistants: [
      {
        type: 'rfp',
        href: '/assistants/rfp',
        title: 'Assistente de RFP',
        description:
          'Gera um draft completo de RFP/RFQ com base nos parâmetros da categoria, no template selecionado e na base de conhecimento.',
        icon: FileText,
      },
    ],
  },
  {
    n: 6,
    title: 'Negociação',
    blurb:
      'Negociação estruturada para maximizar valor — não apenas reduzir preços.',
    assistants: [],
  },
  {
    n: 7,
    title: 'Implementação do Contrato',
    blurb: 'Formalização de acordos claros, alinhados com a estratégia.',
    assistants: [],
  },
  {
    n: 8,
    title: 'Controle e Melhoria Contínua',
    blurb:
      'Monitoramento de KPIs, ajustes de estratégia, busca incessante por melhoria.',
    assistants: [],
  },
];

export function AssistantsHub() {
  return (
    <div className="space-y-10">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Assistentes <span className="text-brand">.</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2 max-w-2xl leading-relaxed">
            Organizados pelos 8 passos do{' '}
            <span className="text-brand font-medium">Strategic Sourcing</span>.
            Cada assistente combina a base de conhecimento com templates
            curados para entregar um artefato pronto.
          </p>
        </div>
        <Link
          href="/assistants/history"
          className="inline-flex items-center gap-1.5 text-sm rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 h-9 transition-all duration-300 active:scale-95"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          Meu histórico
        </Link>
      </div>

      <ol className="space-y-4">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4 md:gap-5">
            <div
              aria-hidden="true"
              className="flex-shrink-0 w-10 h-10 rounded-full border border-brand/30 bg-brand/5 text-brand flex items-center justify-center text-sm font-medium"
            >
              {step.n}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base md:text-lg font-medium">{step.title}</h2>
              <p className="text-xs md:text-sm text-gray-500 mt-1 leading-relaxed">
                {step.blurb}
              </p>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {step.assistants.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    Em breve
                  </div>
                ) : (
                  step.assistants.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Link
                        key={a.type}
                        href={a.href}
                        className="group rounded-xl border border-white/5 bg-[#141414] hover:bg-[#181818] hover:border-brand/30 transition-all duration-300 p-4 block active:scale-[0.98]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 rounded-lg bg-brand/10 border border-brand/20 p-2 text-brand">
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white">
                              {a.title}
                            </div>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                              {a.description}
                            </p>
                            <span className="mt-3 inline-block text-xs font-medium text-brand group-hover:text-brand/80 transition-colors">
                              Começar →
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
