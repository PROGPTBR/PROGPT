'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Check,
  History,
} from 'lucide-react';
import { KraljicMatrixPreview } from './previews/KraljicMatrixPreview';
import { RfpDocumentPreview } from './previews/RfpDocumentPreview';
import { PorterForcesPreview } from './previews/PorterForcesPreview';
import { FinancialScorePreview } from './previews/FinancialScorePreview';
import { AbcCurvePreview } from './previews/AbcCurvePreview';
import { SpendAnalysisPreview } from './previews/SpendAnalysisPreview';
import { SuppliersPreview } from './previews/SuppliersPreview';
import { NegotiationPreview } from './previews/NegotiationPreview';
import { ScorecardPreview } from './previews/ScorecardPreview';
import { HomologacaoPreview } from './previews/HomologacaoPreview';
import { PesquisaPrecosPreview } from './previews/PesquisaPrecosPreview';
import { IndicadoresPreview } from './previews/IndicadoresPreview';

// Hub layout — Spotlight + Roadmap.
//
// Section 1: header + macro progress bar (X/7 ativos)
// Section 2: large spotlight cards for available assistants, each with
//            a stylized SVG preview of the output
// Section 3: compact 7-node roadmap strip (horizontal desktop, vertical
//            mobile) showing the full sourcing pipeline + status
//
// Perfil da Categoria foi removido do hub + chat (confundia usuários); a
// página /assistants/profile e o "Iniciar de um Perfil" no RFP seguem ativos.

type SpotlightAssistant = {
  step: number;
  stepCategory: string;
  href: string;
  title: string;
  short: string;
  bullets: string[];
  Preview: React.ComponentType;
};

const SPOTLIGHTS: SpotlightAssistant[] = [
  {
    step: 1,
    stepCategory: 'Análise',
    href: '/assistants/abc',
    title: 'Análise ABC',
    short:
      'Classifica spend pela curva de Pareto (80/95%), gera plano de ação por classe A/B/C e curva visual.',
    bullets: [
      'Upload de planilha (XLSX, XLS ou CSV)',
      'Classificação determinística A/B/C',
      '.docx + .xlsx multi-sheet + chart',
    ],
    Preview: AbcCurvePreview,
  },
  {
    step: 1,
    stepCategory: 'Análise',
    href: '/assistants/spend_analysis',
    title: 'Análise de Gastos',
    short:
      'Da nota fiscal à estratégia: sobe um lote de invoices (PDF ou planilha), extrai cada nota, classifica e gera KPIs + plano de strategic sourcing.',
    bullets: [
      'Upload de invoices em PDF + planilha (XLSX/CSV)',
      'Extração por IA: PO, país, moeda, total, prazo, categoria',
      'Base classificada + KPIs + Pareto (.xlsx/.docx na fase 2)',
    ],
    Preview: SpendAnalysisPreview,
  },
  {
    step: 2,
    stepCategory: 'Mercado',
    href: '/assistants/porter',
    title: 'Porter',
    short:
      'Análise das 5 Forças de Porter (1979) para uma categoria, com classificação de intensidade e recomendações.',
    bullets: [
      'Rivalidade, entrantes, substitutos, fornecedores, compradores',
      'Intensidade baixa / média / alta por força',
      'Markdown + .docx + chat de refinamento',
    ],
    Preview: PorterForcesPreview,
  },
  {
    step: 2,
    stepCategory: 'Mercado',
    href: '/assistants/suppliers',
    title: 'Busca de Fornecedores',
    short:
      'Encontre fornecedores reais por CNAE + região. Descreva em linguagem natural; a IA classifica e busca empresas ativas na Receita.',
    bullets: [
      'Classificação automática de CNAE',
      'Filtro por estado e porte',
      'Export CSV pra Excel BR',
    ],
    Preview: SuppliersPreview,
  },
  {
    step: 3,
    stepCategory: 'Estratégia',
    href: '/assistants/kraljic',
    title: 'Kraljic',
    short:
      'Classifica seu portfólio na Matriz de Kraljic e gera plano de ação por quadrante.',
    bullets: [
      'Portfólio 2-200 itens',
      'Bubble chart 2×2 + plano',
      '.docx + .xlsx multi-sheet',
    ],
    Preview: KraljicMatrixPreview,
  },
  {
    step: 4,
    stepCategory: 'Engajamento',
    href: '/assistants/rfp',
    title: 'RFP',
    short:
      'Gera draft completo de RFP/RFQ a partir de parâmetros + base de conhecimento.',
    bullets: [
      'Cliente, escopo, prazo, orçamento',
      'Markdown + .docx + .xlsx',
      'Chat de refinamento',
    ],
    Preview: RfpDocumentPreview,
  },
  {
    step: 5,
    stepCategory: 'Negociação',
    href: '/assistants/negotiation',
    title: 'Simulador de Negociação',
    short:
      'Construtor de estratégia (postura, Kraljic, SWOT, SMART, intel de mercado) + simulador de chat onde a IA personifica o fornecedor.',
    bullets: [
      'Form com ZOPA, perfil do fornecedor, objetivo',
      'Estratégia em cards visuais + chat treino',
      'Score 0-100 com 4 dimensões ao encerrar',
    ],
    Preview: NegotiationPreview,
  },
  {
    step: 6,
    stepCategory: 'Contrato',
    href: '/assistants/financial',
    title: 'Análise Financeira',
    short:
      'Score determinístico 0-100 da saúde financeira do fornecedor (12 indicadores, 4 pilares ponderados).',
    bullets: [
      'PDF do Balanço/DRE → extração automática',
      'Score Liquidez/Dívida/Margem/ROE (peso 30/30/20/20)',
      'Recomendação buy/caution/do_not_buy + termos de pagamento',
    ],
    Preview: FinancialScorePreview,
  },
  {
    step: 7,
    stepCategory: 'Gestão de fornecedores',
    href: '/assistants/scorecard',
    title: 'Supplier Scorecard',
    short:
      'Avalia e ranqueia fornecedores por critérios ponderados, com plano de ação por faixa.',
    bullets: [
      'Critérios editáveis com pesos',
      'Ranking + faixas (Estratégico/Desenvolvimento/Saída)',
      '.docx + .xlsx multi-sheet',
    ],
    Preview: ScorecardPreview,
  },
  {
    step: 7,
    stepCategory: 'Gestão de fornecedores',
    href: '/assistants/homologacao',
    title: 'Homologação de Fornecedor',
    short:
      'Informe o CNPJ e ele consulta situação cadastral, score de risco, compliance e certidões na Receita — e gera o relatório de homologação.',
    bullets: [
      'Consulta CNPJ na Receita (BrasilAPI)',
      'Score de risco + recomendação (aprovar/ressalvas/recusar)',
      'Relatório de homologação em .docx',
    ],
    Preview: HomologacaoPreview,
  },
  {
    step: 8,
    stepCategory: 'Custo e preço',
    href: '/assistants/pesquisa_precos',
    title: 'Pesquisa de Preços',
    short:
      'Descreva os itens e ele busca o preço de referência nas compras públicas (CATMAT / Painel de Preços) — mediana, faixa e fontes.',
    bullets: [
      'Preço de referência por item (mediana + faixa p25–p75)',
      'Fonte: compras públicas reais (Painel de Preços)',
      'Mapa de preços em .docx para RFP e negociação',
    ],
    Preview: PesquisaPrecosPreview,
  },
  {
    step: 9,
    stepCategory: 'Macro',
    href: '/assistants/indicadores',
    title: 'Indicadores Econômicos',
    short:
      'Painel ao vivo do Banco Central (Selic, CDI, IPCA, IGP-M, dólar, euro) com leitura para compras.',
    bullets: [
      'Selic, CDI, IPCA, IGP-M, dólar e euro com gráfico',
      'Leitura macro orientada a custo e reajuste (IA)',
      'Fonte: Banco Central (séries SGS), atualizado diariamente',
    ],
    Preview: IndicadoresPreview,
  },
];

type RoadmapStep = {
  n: number;
  shortLabel: string;
  fullName: string;
  available: boolean;
  href?: string;
};

const STEPS: RoadmapStep[] = [
  { n: 1, shortLabel: 'Análise', fullName: 'Análise da Categoria', available: true, href: '/assistants/abc' },
  { n: 2, shortLabel: 'Mercado', fullName: 'Visão do Mercado Fornecedor', available: true, href: '/assistants/porter' },
  { n: 3, shortLabel: 'Estratégia', fullName: 'Estratégia de Sourcing', available: true, href: '/assistants/kraljic' },
  { n: 4, shortLabel: 'Engajamento', fullName: 'Engajamento dos Fornecedores', available: true, href: '/assistants/rfp' },
  { n: 5, shortLabel: 'Negociação', fullName: 'Negociação', available: true, href: '/assistants/negotiation' },
  { n: 6, shortLabel: 'Contrato', fullName: 'Implementação do Contrato', available: true, href: '/assistants/financial' },
  { n: 7, shortLabel: 'Controle', fullName: 'Controle e Melhoria Contínua', available: true, href: '/assistants/scorecard' },
];

const ACTIVE_COUNT = STEPS.filter((s) => s.available).length;
const PROGRESS_PCT = Math.round((ACTIVE_COUNT / STEPS.length) * 100);

export function AssistantsHub() {
  return (
    <div className="space-y-12">
      {/* ───── Section 1: Header + progress ───── */}
      <header className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Assistentes <span className="text-brand">.</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {ACTIVE_COUNT} de {STEPS.length} passos do{' '}
              <span className="text-brand font-medium">Strategic Sourcing</span>{' '}
              com assistente ativo.
            </p>
          </div>
          <Link
            href="/assistants/history"
            className="inline-flex items-center gap-1.5 text-sm rounded-full border border-border bg-muted hover:bg-accent text-muted-foreground hover:text-foreground px-4 h-9 transition-all duration-300 active:scale-95"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Meu histórico
          </Link>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-brand rounded-full transition-all duration-500 ease-out"
              style={{ width: `${PROGRESS_PCT}%` }}
              role="progressbar"
              aria-valuenow={ACTIVE_COUNT}
              aria-valuemin={0}
              aria-valuemax={STEPS.length}
              aria-label={`${ACTIVE_COUNT} de ${STEPS.length} passos ativos`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
            <span>Roadmap do produto</span>
            <span>{PROGRESS_PCT}%</span>
          </div>
        </div>
      </header>

      {/* ───── Section 2: Spotlight ───── */}
      <section aria-label="Assistentes disponíveis">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {SPOTLIGHTS.map((a) => {
            const { Preview } = a;
            return (
              <Link
                key={a.href}
                href={a.href}
                className="group flex flex-col rounded-2xl border border-border bg-card hover:bg-accent hover:border-brand/30 transition-all duration-300 p-6 active:scale-[0.99]"
              >
                {/* Preview */}
                <div className="rounded-xl bg-black/40 overflow-hidden aspect-[16/9] mb-5 ring-1 ring-white/5">
                  <Preview />
                </div>

                {/* Step badge */}
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                  Passo {a.step} · {a.stepCategory}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {a.title}
                </h2>

                {/* Short description */}
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {a.short}
                </p>

                {/* Capability bullets */}
                <ul className="mt-4 space-y-1.5">
                  {a.bullets.map((b) => (
                    <li
                      key={b}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Check
                        className="h-3 w-3 text-brand flex-shrink-0"
                        aria-hidden="true"
                      />
                      {b}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand group-hover:text-brand/80 transition-colors">
                  Abrir assistente
                  <ArrowRight
                    className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ───── Section 3: Roadmap strip ───── */}
      <section aria-label="Roadmap dos 7 passos">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-5">
          No roadmap
        </div>

        {/* Desktop: horizontal strip */}
        <div className="hidden md:block relative">
          {/* Connecting line */}
          <div
            aria-hidden="true"
            className="absolute top-5 left-[5%] right-[5%] h-px bg-muted"
          />

          <ol className="relative grid grid-cols-7 gap-1">
            {STEPS.map((s) => {
              const tooltip = s.available
                ? `Disponível — ${s.fullName}`
                : `Em breve — ${s.fullName}`;
              const NodeWrapper: React.ElementType = s.available
                ? Link
                : 'div';
              const wrapperProps = s.available
                ? { href: s.href!, title: tooltip }
                : { title: tooltip };
              return (
                <li key={s.n} className="flex flex-col items-center gap-2">
                  <NodeWrapper
                    {...wrapperProps}
                    className={`relative flex items-center justify-center w-10 h-10 rounded-full text-xs font-semibold transition-all duration-300 ${
                      s.available
                        ? 'bg-brand/10 border-2 border-brand text-brand hover:bg-brand/20 hover:scale-110 cursor-pointer active:scale-95'
                        : 'bg-muted/40 border border-border text-muted-foreground cursor-default'
                    }`}
                  >
                    {s.n}
                  </NodeWrapper>
                  <div className="text-center">
                    <div
                      className={`text-[10px] font-medium ${
                        s.available ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {s.shortLabel}
                    </div>
                    <div
                      className={`mt-0.5 text-[9px] uppercase tracking-wider ${
                        s.available ? 'text-brand' : 'text-muted-foreground'
                      }`}
                    >
                      {s.available ? 'Disponível' : 'Em breve'}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Mobile: vertical compact list */}
        <ol className="md:hidden relative pl-8 space-y-3">
          {/* Vertical dashed line */}
          <div
            aria-hidden="true"
            className="absolute top-5 bottom-5 left-[19px] w-px border-l border-dashed border-border"
          />
          {STEPS.map((s) => {
            const tooltip = s.available
              ? `Disponível — ${s.fullName}`
              : `Em breve — ${s.fullName}`;
            const NodeWrapper: React.ElementType = s.available ? Link : 'div';
            const wrapperProps = s.available
              ? { href: s.href!, title: tooltip }
              : { title: tooltip };
            return (
              <li key={s.n} className="relative flex items-center gap-3">
                <NodeWrapper
                  {...wrapperProps}
                  className={`absolute -left-8 flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                    s.available
                      ? 'bg-brand/10 border-2 border-brand text-brand active:scale-95'
                      : 'bg-muted/40 border border-border text-muted-foreground'
                  }`}
                >
                  {s.n}
                </NodeWrapper>
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`text-sm ${
                      s.available ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {s.fullName}
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      s.available ? 'text-brand' : 'text-muted-foreground'
                    }`}
                  >
                    {s.available ? 'Disponível' : 'Em breve'}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
