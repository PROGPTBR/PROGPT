'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import { ArrowRight, Check, Mail } from 'lucide-react';

import {
  ASSISTANTS,
  type AssistantPreviewKey,
} from './assistants-data';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/constants';

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
import { DashboardPreview } from './previews/DashboardPreview';
import { SimuladorTributarioPreview } from './previews/SimuladorTributarioPreview';
import { SimuladorLogisticoPreview } from './previews/SimuladorLogisticoPreview';
import { GraficoRapidoPreview } from './previews/GraficoRapidoPreview';

/**
 * Relaciona o previewKey definido em assistants-data.ts
 * ao componente visual utilizado no card do Hub.
 *
 * Assim, os dados dos assistentes ficam centralizados
 * em assistants-data.ts, enquanto os componentes pesados
 * de preview continuam sendo carregados somente nesta página.
 */
const BADGE_LABEL: Record<'em_breve' | 'sob_demanda', string> = {
  em_breve: 'Em breve',
  sob_demanda: 'Sob demanda',
};

const PREVIEWS: Record<AssistantPreviewKey, ComponentType> = {
  dashboard: DashboardPreview,
  abc: AbcCurvePreview,
  spend: SpendAnalysisPreview,
  porter: PorterForcesPreview,
  suppliers: SuppliersPreview,
  kraljic: KraljicMatrixPreview,
  rfp: RfpDocumentPreview,
  negotiation: NegotiationPreview,
  financial: FinancialScorePreview,
  scorecard: ScorecardPreview,
  homologacao: HomologacaoPreview,
  pesquisa_precos: PesquisaPrecosPreview,
  indicadores: IndicadoresPreview,
  simulador_tributario: SimuladorTributarioPreview,
  simulador_logistico: SimuladorLogisticoPreview,
  grafico_rapido: GraficoRapidoPreview,
};

export function AssistantsHub() {
  return (
    <div className="space-y-12">
      {/* ───── Header ───── */}
      <header>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Assistentes <span className="text-brand">.</span>
        </h1>
      </header>

      {/* ───── Spotlight cards ───── */}
      <section aria-label="Assistentes disponíveis">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ASSISTANTS.map((assistant) => {
            const Preview = PREVIEWS[assistant.previewKey];
            const badge = assistant.badge;

            const inner = (
              <>
                {/* Preview */}
                <div className="relative rounded-xl bg-black/40 overflow-hidden aspect-[16/9] mb-5 ring-1 ring-white/5">
                  <Preview />

                  {badge && (
                    <span className="absolute right-2 top-2 rounded-full bg-brand-gradient px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-black shadow">
                      {BADGE_LABEL[badge]}
                    </span>
                  )}
                </div>

                {/* Título */}
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  {assistant.title}
                </h2>

                {/* Descrição */}
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {assistant.short}
                </p>

                {/* Recursos */}
                <ul className="mt-4 space-y-1.5">
                  {assistant.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Check
                        className="h-3 w-3 text-brand flex-shrink-0"
                        aria-hidden="true"
                      />

                      {bullet}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {badge === 'sob_demanda' ? (
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Falar com o time
                  </div>
                ) : badge === 'em_breve' ? (
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    Em breve
                  </div>
                ) : (
                  <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand group-hover:text-brand/80 transition-colors">
                    Abrir assistente

                    <ArrowRight
                      className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </>
            );

            /**
             * Assistentes "sob demanda" abrem o cliente de email do
             * comprador (contato comercial) em vez da rota do assistente.
             */
            if (badge === 'sob_demanda') {
              return (
                <a
                  key={assistant.id}
                  href={`mailto:${LEGAL_CONTACT_EMAIL}?subject=${encodeURIComponent(
                    `Interesse: ${assistant.title}`,
                  )}`}
                  className="group flex flex-col rounded-2xl border border-border bg-card hover:bg-accent hover:border-brand/30 transition-all duration-300 p-6 active:scale-[0.99]"
                >
                  {inner}
                </a>
              );
            }

            /**
             * Assistentes marcados como "Em breve"
             * são exibidos visualmente, mas não são clicáveis.
             */
            if (badge === 'em_breve') {
              return (
                <div
                  key={assistant.id}
                  aria-disabled="true"
                  className="flex flex-col rounded-2xl border border-border bg-card p-6 opacity-70 cursor-default select-none"
                >
                  {inner}
                </div>
              );
            }

            /**
             * Assistentes disponíveis levam para
             * a rota definida em assistants-data.ts.
             */
            return (
              <Link
                key={assistant.id}
                href={assistant.href}
                className="group flex flex-col rounded-2xl border border-border bg-card hover:bg-accent hover:border-brand/30 transition-all duration-300 p-6 active:scale-[0.99]"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}