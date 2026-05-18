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
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assistentes</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Organizados pelos 8 passos do Strategic Sourcing. Cada assistente
            combina a base de conhecimento com templates curados para entregar
            um artefato pronto.
          </p>
        </div>
        <Link
          href="/assistants/history"
          className="inline-flex items-center gap-1.5 text-sm rounded-md border border-input bg-background hover:bg-accent px-3 h-9"
        >
          <History className="h-4 w-4" />
          Meu histórico
        </Link>
      </div>

      <ol className="space-y-4">
        {STEPS.map((step) => (
          <li key={step.n} className="flex gap-4">
            <div
              aria-hidden="true"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold"
            >
              {step.n}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold">{step.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step.blurb}
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {step.assistants.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border p-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Em breve
                  </div>
                ) : (
                  step.assistants.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Link
                        key={a.type}
                        href={a.href}
                        className="rounded-md border border-border bg-card hover:bg-accent transition-colors p-3 block"
                      >
                        <div className="flex items-start gap-2">
                          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{a.title}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {a.description}
                            </p>
                            <span className="mt-2 inline-block text-xs text-primary font-medium">
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
