'use client';

import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
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

// Hub layout — header + spotlight cards.
//
// Cards grandes (com preview SVG do output) dos assistentes disponíveis. O
// roadmap/progresso de Strategic Sourcing (barra de progresso, badge "Passo N"
// e a tira de 7 passos) foi removido do layout em 2026-06-24.
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
      'KPIs + Pareto + strategic sourcing (.xlsx + .docx)',
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

export function AssistantsHub() {
  return (
    <div className="space-y-12">
      {/* ───── Header (histórico vive no chrome do layout, sem duplicar aqui) ───── */}
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Assistentes <span className="text-brand">.</span>
        </h1>
      </header>

      {/* ───── Spotlight cards ───── */}
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

    </div>
  );
}
