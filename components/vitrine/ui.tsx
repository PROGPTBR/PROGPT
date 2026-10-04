'use client';

import { toast } from 'sonner';
import { MessageCircle, Sparkles } from 'lucide-react';

import {
  PRODUTO_VITRINE_LABEL,
  solicitarProdutoHref,
  type ProdutoVitrine,
} from '@/lib/vitrine/contato';

// Kit visual das vitrines sob demanda (sub-projeto 68). Segue o mesmo
// vocabulário do Painel (components/dashboard/UnifiedDashboard.tsx): cartões
// rounded-xl com borda, KPI em caixa alta pequena, barras em bg-brand.

// ─── Cabeçalho + aviso de demonstração ────────────────────────────────────

export function VitrineCabecalho({
  produto,
  titulo,
  descricao,
}: {
  produto: ProdutoVitrine;
  titulo: string;
  descricao: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient-soft px-2.5 py-0.5 text-[11px] font-medium text-brand">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Demonstração
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{descricao}</p>
      </div>
      <a
        data-tour="vitrine-contato"
        href={solicitarProdutoHref(produto)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        Quero na minha empresa
      </a>
    </header>
  );
}

export function AvisoDemonstracao({ produto }: { produto: ProdutoVitrine }) {
  return (
    <div className="mb-6 flex flex-col gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-foreground/90">
        Você está vendo dados <strong>fictícios</strong> de exemplo. O {PRODUTO_VITRINE_LABEL[produto]} é
        implantado <strong>sob demanda</strong>, com os dados e o processo da sua empresa.
      </p>
      <a
        href={solicitarProdutoHref(produto)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 text-sm font-medium text-brand hover:underline"
      >
        Falar com a 2B Supply →
      </a>
    </div>
  );
}

/**
 * Toda ação que gravaria algo (nova SP, nova medição, exportar...) passa por
 * aqui: a demo não grava nada, só explica e oferece o contato comercial.
 */
export function avisarSobDemanda(produto: ProdutoVitrine, acao: string) {
  toast(`${acao} está disponível na versão contratada`, {
    description: `Esta é uma demonstração com dados de exemplo. O ${PRODUTO_VITRINE_LABEL[produto]} é implantado sob demanda.`,
    action: {
      label: 'Falar no WhatsApp',
      onClick: () => window.open(solicitarProdutoHref(produto), '_blank', 'noopener,noreferrer'),
    },
  });
}

// ─── Navegação por abas ───────────────────────────────────────────────────

export function Abas<T extends string>({
  abas,
  ativa,
  onChange,
}: {
  abas: { id: T; label: string }[];
  ativa: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" data-tour="vitrine-abas" className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
      {abas.map((aba) => (
        <button
          key={aba.id}
          type="button"
          role="tab"
          aria-selected={aba.id === ativa}
          onClick={() => onChange(aba.id)}
          className={
            'whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ' +
            (aba.id === ativa
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground')
          }
        >
          {aba.label}
        </button>
      ))}
    </div>
  );
}

// ─── Blocos ───────────────────────────────────────────────────────────────

export function Kpi({
  label,
  valor,
  detalhe,
  tom = 'padrao',
}: {
  label: string;
  valor: string;
  detalhe?: string;
  tom?: 'padrao' | 'alerta' | 'positivo';
}) {
  const cor = tom === 'alerta' ? 'text-destructive' : tom === 'positivo' ? 'text-emerald-600 dark:text-emerald-400' : '';
  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-semibold leading-tight tabular-nums sm:text-xl ${cor}`}>{valor}</div>
      {detalhe && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

export function Secao({
  titulo,
  acoes,
  children,
  className = '',
}: {
  titulo: string;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{titulo}</h2>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function BarraProgresso({ pct, className = '' }: { pct: number; className?: string }) {
  const largura = Math.max(0, Math.min(100, pct));
  const cor = largura >= 100 ? 'bg-emerald-500' : largura >= 60 ? 'bg-brand' : largura >= 30 ? 'bg-amber-500' : 'bg-sky-400';
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-muted ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(largura)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
    </div>
  );
}

export function ListaBarras({
  linhas,
  formatar = (n) => String(n),
  neutro = false,
}: {
  linhas: { label: string; valor: number; cor?: string; detalhe?: string }[];
  formatar?: (n: number) => string;
  /** Barras cinza, sem cor: para quadros lado a lado não "conversarem" por cor. */
  neutro?: boolean;
}) {
  const max = linhas.reduce((a, l) => Math.max(a, l.valor), 0) || 1;
  return (
    <div className="space-y-2.5">
      {linhas.map((l) => (
        <div key={l.label}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{l.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {formatar(l.valor)}
              {l.detalhe && <span className="ml-1.5">{l.detalhe}</span>}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded bg-muted">
            <div
              className={`h-full rounded ${neutro ? 'bg-muted-foreground/45' : l.cor ? '' : 'bg-brand/70'}`}
              style={{ width: `${(l.valor / max) * 100}%`, backgroundColor: neutro ? undefined : l.cor }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gráfico de colunas em SVG puro (sem lib), no mesmo espírito do Painel. */
export function GraficoColunas({
  serie,
  formatar,
}: {
  serie: { rotulo: string; valor: number }[];
  formatar: (n: number) => string;
}) {
  const max = serie.reduce((a, p) => Math.max(a, p.valor), 0) || 1;
  const altura = 160;
  return (
    <div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height: altura + 20 }}>
        {serie.map((p) => {
          const h = Math.max(p.valor > 0 ? 4 : 0, (p.valor / max) * altura);
          return (
            <div key={p.rotulo} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="truncate text-[10px] tabular-nums text-muted-foreground">
                {p.valor > 0 ? formatar(p.valor) : '—'}
              </span>
              <div
                className="w-full max-w-[56px] rounded-t-md bg-gradient-to-t from-brand/60 to-brand"
                style={{ height: h }}
                title={`${p.rotulo}: ${formatar(p.valor)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-3">
        {serie.map((p) => (
          <span key={p.rotulo} className="flex-1 truncate text-center text-[11px] text-muted-foreground">
            {p.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

export type TomSelo = 'neutro' | 'azul' | 'verde' | 'amarelo' | 'vermelho' | 'roxo' | 'cinza';

const SELO: Record<TomSelo, string> = {
  neutro: 'bg-muted text-foreground/80',
  azul: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  verde: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  amarelo: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  vermelho: 'bg-red-500/15 text-red-700 dark:text-red-300',
  roxo: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  cinza: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
};

export function Selo({ tom = 'neutro', children }: { tom?: TomSelo; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${SELO[tom]}`}>
      {children}
    </span>
  );
}

export const formatarBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

/** R$ abreviado para eixos e cards (R$ 1,2 mi / R$ 350 mil). */
export function formatarBRLCurto(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (Math.abs(n) >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return formatarBRL(n);
}

export const formatarNumero = (n: number, casas = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
