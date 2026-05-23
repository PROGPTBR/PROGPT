'use client';

import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Download,
  FlaskConical,
  Layers,
  Leaf,
  Lightbulb,
  Newspaper,
  PieChart,
  Search,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  NegotiationStrategyResult,
  NegotiationStrategyParams,
  PorterLevel,
} from '@/lib/assistants/types';
import { KRALJIC_QUADRANT_LABELS } from '@/lib/assistants/types';

type Props = {
  params: NegotiationStrategyParams;
  result: NegotiationStrategyResult;
  onStartSimulation: () => void;
  onDownload: () => void;
  isDownloading?: boolean;
};

const LEVEL_LABEL: Record<PorterLevel, string> = {
  low: 'LOW',
  med: 'MED',
  high: 'HIGH',
};

const LEVEL_COLOR: Record<PorterLevel, string> = {
  low: 'text-amber-600 dark:text-amber-400',
  med: 'text-yellow-600 dark:text-yellow-400',
  high: 'text-emerald-600 dark:text-emerald-400',
};

function PowerBar({ level }: { level: PorterLevel }) {
  const idx = level === 'low' ? 0 : level === 'med' ? 1 : 2;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-colors ${
              i <= idx
                ? i === 0
                  ? 'bg-amber-500/70'
                  : i === 1
                    ? 'bg-yellow-500/70'
                    : 'bg-emerald-500/70'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
        <span className={idx === 0 ? LEVEL_COLOR.low : 'text-muted-foreground'}>
          LOW
        </span>
        <span className={idx === 1 ? LEVEL_COLOR.med : 'text-muted-foreground'}>
          MED
        </span>
        <span
          className={idx === 2 ? LEVEL_COLOR.high : 'text-muted-foreground'}
        >
          HIGH
        </span>
      </div>
      <div
        className={`text-[10px] font-medium uppercase tracking-wider ${LEVEL_COLOR[level]}`}
      >
        Atual: {LEVEL_LABEL[level]}
      </div>
    </div>
  );
}

export function NegotiationStrategyResult({
  params,
  result,
  onStartSimulation,
  onDownload,
  isDownloading,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Banner Recomendação Final */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-brand/80 dark:from-brand/90 dark:to-brand/60 p-7 md:p-9 text-black">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -bottom-12 opacity-15"
        >
          <PieChart className="h-72 w-72" strokeWidth={1} />
        </div>
        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Recomendação Final
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
            {result.posture.label}.
          </h1>
          <p className="text-sm md:text-base italic leading-relaxed max-w-3xl whitespace-pre-line">
            {result.posture.paragraph.startsWith('"')
              ? result.posture.paragraph
              : `"${result.posture.paragraph}"`}
          </p>
        </div>
      </div>

      {/* Cards: Poder de Barganha + Kraljic */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div className="space-y-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Poder de Barganha do Comprador
            </div>
            <PowerBar level={result.bargainingPower.buyer} />
          </div>
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Poder de Barganha do Fornecedor
            </div>
            <PowerBar level={result.bargainingPower.supplier} />
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
            Quadrante Kraljic
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            {result.kraljic.label}
          </h3>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
            {result.kraljic.explanation}
          </p>
        </div>
      </div>

      {/* Inteligência de Mercado — 5 cards */}
      <section className="rounded-2xl border border-border bg-card p-5 md:p-6 space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Inteligência de Mercado
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <IntelCard
            icon={Newspaper}
            title="Notícias Recentes"
            text={result.marketIntel.news}
          />
          <IntelCard
            icon={TrendingUp}
            title="Resultados Financeiros e Fusões/Aquisições"
            text={result.marketIntel.financials}
          />
          <IntelCard
            icon={Lightbulb}
            title="Inovações Recentes"
            text={result.marketIntel.innovations}
          />
          <IntelCard
            icon={AlertTriangle}
            title="Riscos Identificados"
            text={result.marketIntel.risks}
          />
          <IntelCard
            icon={Leaf}
            title="Sustentabilidade"
            text={result.marketIntel.sustainability}
          />
        </div>
      </section>

      {/* Sumário Executivo + SWOT + SMART */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sumário */}
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
            <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
            Sumário Executivo
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">
            {result.executiveSummary}
          </p>
        </section>

        {/* SWOT + SMART (col 2-3) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SwotCard
              icon={CheckCircle2}
              title="Forças"
              tone="strength"
              items={result.swot.strengths}
            />
            <SwotCard
              icon={TrendingDown}
              title="Fraquezas"
              tone="weakness"
              items={result.swot.weaknesses}
            />
            <SwotCard
              icon={Sparkles}
              title="Oportunidades"
              tone="opportunity"
              items={result.swot.opportunities}
            />
            <SwotCard
              icon={AlertTriangle}
              title="Ameaças"
              tone="threat"
              items={result.swot.threats}
            />
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Metas SMART da Missão
            </div>
            <SmartRow
              letter="S"
              title="Específico"
              text={result.smartGoals.specific}
            />
            <SmartRow
              letter="M"
              title="Mensurável"
              text={result.smartGoals.measurable}
            />
            <SmartRow
              letter="A"
              title="Atingível"
              text={result.smartGoals.achievable}
            />
            <SmartRow
              letter="R"
              title="Relevante"
              text={result.smartGoals.relevant}
            />
            <SmartRow
              letter="T"
              title="Temporal"
              text={result.smartGoals.temporal}
            />
          </section>
        </div>
      </div>

      {/* CTA: Simular */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-brand/5 p-5">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-foreground">
            Pronto para praticar?
          </div>
          <div className="text-xs text-muted-foreground">
            Treine a abordagem em uma simulação multi-turno onde a IA personifica
            o {params.supplierName}.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={onDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card hover:bg-accent h-10 px-4 text-xs font-medium text-foreground transition-all duration-300 active:scale-95 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {isDownloading ? 'Gerando…' : 'Baixar .docx'}
          </button>
          <button
            type="button"
            onClick={onStartSimulation}
            className="inline-flex items-center gap-2 rounded-full bg-brand text-black hover:bg-brand/90 h-10 px-5 text-sm font-semibold transition-all duration-300 active:scale-95"
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            Iniciar Simulação de Negociação
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Kraljic input */}
      {params.kraljicQuadrant && (
        <div className="text-xs text-muted-foreground text-center">
          <Layers className="inline-block h-3 w-3 mr-1" aria-hidden="true" />
          Kraljic classificado pelo usuário no setup:{' '}
          {KRALJIC_QUADRANT_LABELS[params.kraljicQuadrant]}
        </div>
      )}
    </div>
  );
}

function IntelCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Newspaper;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl bg-background/50 border border-border p-4 space-y-2">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      <p className="text-xs text-foreground/85 leading-relaxed whitespace-pre-line">
        {text}
      </p>
    </div>
  );
}

const SWOT_TONE: Record<
  'strength' | 'weakness' | 'opportunity' | 'threat',
  { bg: string; border: string; text: string; bullet: string }
> = {
  strength: {
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/20',
    border: 'border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    bullet: 'bg-emerald-500',
  },
  weakness: {
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
    border: 'border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-300',
    bullet: 'bg-rose-500',
  },
  opportunity: {
    bg: 'bg-blue-50/40 dark:bg-blue-950/20',
    border: 'border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    bullet: 'bg-blue-500',
  },
  threat: {
    bg: 'bg-amber-50/40 dark:bg-amber-950/20',
    border: 'border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    bullet: 'bg-amber-500',
  },
};

function SwotCard({
  icon: Icon,
  title,
  tone,
  items,
}: {
  icon: typeof CheckCircle2;
  title: string;
  tone: keyof typeof SWOT_TONE;
  items: string[];
}) {
  const t = SWOT_TONE[tone];
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-4 space-y-2.5`}>
      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${t.text}`}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((b, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-xs text-foreground/85"
          >
            <span
              className={`mt-1.5 inline-block h-1 w-1 rounded-full ${t.bullet} flex-shrink-0`}
              aria-hidden="true"
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SmartRow({
  letter,
  title,
  text,
}: {
  letter: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-sm font-bold text-brand">
        {letter}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        <div className="text-xs text-foreground/85 leading-relaxed">{text}</div>
      </div>
    </div>
  );
}
