'use client';

import {
  ArrowRight,
  Award,
  CheckCircle2,
  Download,
  Lightbulb,
  TrendingDown,
} from 'lucide-react';
import type { NegotiationScore } from '@/lib/assistants/types';

type Props = {
  score: NegotiationScore;
  onDownload: () => void;
  onNewNegotiation: () => void;
};

const DIMENSION_LABELS: Record<keyof NegotiationScore['dimensions'], string> = {
  anchoring: 'Anchoring',
  concessions: 'Concessões',
  batna: 'BATNA',
  closing: 'Fechamento',
};

function scoreColor(s: number): string {
  if (s >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-rose-600 dark:text-rose-400';
}

function barColor(s: number): string {
  if (s >= 80) return 'bg-emerald-500';
  if (s >= 60) return 'bg-yellow-500';
  return 'bg-rose-500';
}

export function NegotiationScoreView({
  score,
  onDownload,
  onNewNegotiation,
}: Props) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score overall */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand/80 dark:from-brand/90 dark:to-brand/60 p-7 md:p-9 text-black text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 opacity-15"
        >
          <Award className="h-56 w-56" strokeWidth={1} />
        </div>
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
            Score da Sua Negociação
          </div>
          <div className="text-6xl md:text-7xl font-bold tracking-tight">
            {score.overall}
            <span className="text-2xl md:text-3xl opacity-60">/100</span>
          </div>
        </div>
      </div>

      {/* 4 dimensões */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Dimensões avaliadas
        </div>
        {(Object.keys(score.dimensions) as Array<keyof NegotiationScore['dimensions']>).map(
          (k) => {
            const v = score.dimensions[k];
            return (
              <div key={k} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-foreground">
                    {DIMENSION_LABELS[k]}
                  </div>
                  <div className={`text-xs font-bold ${scoreColor(v)}`}>
                    {v}/100
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${barColor(v)} transition-all duration-700`}
                    style={{ width: `${v}%` }}
                  />
                </div>
              </div>
            );
          },
        )}
      </section>

      {/* Strengths + Weaknesses + Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Pontos fortes
          </div>
          <ul className="space-y-1.5">
            {score.strengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-foreground/85"
              >
                <span
                  className="mt-1.5 inline-block h-1 w-1 rounded-full bg-emerald-500 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-50/40 dark:bg-rose-950/20 p-4 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
            Pontos a melhorar
          </div>
          <ul className="space-y-1.5">
            {score.weaknesses.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-foreground/85"
              >
                <span
                  className="mt-1.5 inline-block h-1 w-1 rounded-full bg-rose-500 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
            Recomendações
          </div>
          <ul className="space-y-1.5">
            {score.recommendations.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-foreground/85"
              >
                <span
                  className="mt-1.5 inline-block h-1 w-1 rounded-full bg-blue-500 flex-shrink-0"
                  aria-hidden="true"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card hover:bg-accent h-10 px-5 text-xs font-medium text-foreground transition-all duration-300 active:scale-95"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Baixar transcript .docx
        </button>
        <button
          type="button"
          onClick={onNewNegotiation}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-brand text-black hover:bg-brand/90 h-10 px-5 text-sm font-semibold transition-all duration-300 active:scale-95"
        >
          Nova negociação
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
