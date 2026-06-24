import { govGet } from '@/lib/govdata/client';
import { cached } from '@/lib/govdata/cache';
import { parseBacenNumber, SGS } from '@/lib/govdata/indicadores';
import type { BacenPonto } from '@/lib/govdata/types';
import type { SpendAnalysisParams } from '@/lib/assistants/types';

// Conversão cambial das invoices para a moeda de referência (BRL por padrão).
//
// Modo 'ptax': usa a cotação PTAX de venda do BACEN (USD série 1, EUR 21619)
// pela data de cada nota — pegando o último pregão <= data (fim de semana /
// feriado caem no dia útil anterior). Moeda fora de {BRL,USD,EUR} → null
// (sem câmbio; reportada à parte no cube).
//
// Modo 'fixed': taxas fixas informadas pelo usuário (ref-por-unidade da moeda).
//
// Tudo fail-soft: qualquer falha de rede → série vazia → totalRef null.

const TTL_PTAX = 24 * 60 * 60 * 1000; // cotação de um dia passado não muda

const PTAX_SERIES: Record<string, number> = {
  USD: SGS.CAMBIO_USD,
  EUR: SGS.CAMBIO_EUR,
};

export type RatePoint = { iso: string; rate: number }; // iso = YYYY-MM-DD, rate = BRL por 1 unidade

export type FxInput = {
  total: number | null;
  currency: string | null;
  date: string | null; // YYYY-MM-DD
};
export type FxOutput = { totalRef: number | null; fxRate: number | null };
export type FxResolver = (input: FxInput) => FxOutput;

// ── Helpers puros ─────────────────────────────────────────────────────────

function brDateToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function ddmmyyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Última cotação com iso <= dateIso; sem data → última disponível; antes da
 *  série → primeira. Série deve vir ordenada ascendente. */
export function pickNearestRate(series: RatePoint[], dateIso: string | null): number | null {
  if (series.length === 0) return null;
  if (!dateIso) return series[series.length - 1]!.rate;
  let chosen: number | null = null;
  for (const p of series) {
    if (p.iso <= dateIso) chosen = p.rate;
    else break;
  }
  return chosen ?? series[0]!.rate;
}

/** Conversão pura, dado o mapa de séries PTAX já carregado (BRL-por-unidade). */
export function computeConversion(
  input: FxInput,
  opts: {
    ref: string;
    fxMode: 'ptax' | 'fixed';
    fixedRates: Record<string, number>; // ref-por-unidade
    ptaxByCcy: Record<string, RatePoint[]>; // BRL-por-unidade
  },
): FxOutput {
  const { total } = input;
  const ccy = (input.currency ?? '').toUpperCase();
  const ref = opts.ref.toUpperCase();
  if (total == null || !ccy) return { totalRef: null, fxRate: null };
  if (ccy === ref) return { totalRef: total, fxRate: 1 };

  if (opts.fxMode === 'fixed') {
    const r = opts.fixedRates[ccy];
    if (typeof r === 'number' && Number.isFinite(r) && r > 0) {
      return { totalRef: total * r, fxRate: r };
    }
    return { totalRef: null, fxRate: null };
  }

  // ptax: brl-por-unidade de cada moeda (BRL = 1).
  const brlPerUnit = (c: string): number | null => {
    if (c === 'BRL') return 1;
    const s = opts.ptaxByCcy[c];
    return s ? pickNearestRate(s, input.date) : null;
  };
  const ccyBrl = brlPerUnit(ccy);
  const refBrl = brlPerUnit(ref);
  if (ccyBrl == null || refBrl == null || refBrl === 0) {
    return { totalRef: null, fxRate: null };
  }
  const fxRate = ccyBrl / refBrl; // unidades de ref por 1 unidade de ccy
  return { totalRef: total * fxRate, fxRate };
}

// ── Fetch + builder ────────────────────────────────────────────────────────

async function fetchPtaxSeries(codigo: number, ini: Date, fim: Date): Promise<RatePoint[]> {
  const key = `bacen-ptax:${codigo}:${ddmmyyyy(ini)}:${ddmmyyyy(fim)}`;
  try {
    const pts = await cached(
      key,
      () =>
        govGet<BacenPonto[]>('bacen', `/serie/bcdata.sgs.${codigo}/dados`, {
          formato: 'json',
          dataInicial: ddmmyyyy(ini),
          dataFinal: ddmmyyyy(fim),
        }),
      TTL_PTAX,
    );
    return pts
      .map((p) => ({ iso: brDateToIso(p.data), rate: parseBacenNumber(p.valor) }))
      .filter((p): p is RatePoint => p.iso != null && p.rate != null)
      .sort((a, b) => a.iso.localeCompare(b.iso));
  } catch {
    return [];
  }
}

/**
 * Monta o resolvedor de câmbio para um run: pré-carrega as séries PTAX das
 * moedas presentes (modo ptax) e devolve uma função síncrona de conversão.
 */
export async function buildFxResolver(
  params: SpendAnalysisParams,
  invoices: Array<{ currency: string | null; invoiceDate: string | null }>,
): Promise<FxResolver> {
  const ref = (params.referenceCurrency ?? 'BRL').toUpperCase();
  const fxMode = params.fxMode ?? 'ptax';
  const fixedRates: Record<string, number> = {};
  for (const [k, v] of Object.entries(params.fxRates ?? {})) {
    if (typeof v === 'number') fixedRates[k.toUpperCase()] = v;
  }

  if (fxMode === 'fixed') {
    return (input) => computeConversion(input, { ref, fxMode, fixedRates, ptaxByCcy: {} });
  }

  // Moedas que precisam de série PTAX (USD/EUR) — inclui o ref se for uma delas.
  const ccys = new Set<string>();
  for (const inv of invoices) {
    const c = (inv.currency ?? '').toUpperCase();
    if (c && c !== 'BRL' && c in PTAX_SERIES) ccys.add(c);
  }
  if (ref !== 'BRL' && ref in PTAX_SERIES) ccys.add(ref);

  // Janela: do menor ao maior invoiceDate, com folga p/ dias não-úteis.
  const dates = invoices
    .map((i) => i.invoiceDate)
    .filter((d): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const fim = new Date();
  let ini = new Date(fim);
  ini.setMonth(ini.getMonth() - 1);
  if (dates.length > 0) {
    const min = new Date(`${dates[0]}T00:00:00`);
    min.setDate(min.getDate() - 12); // folga p/ feriado/fim de semana
    ini = min;
    const max = new Date(`${dates[dates.length - 1]}T00:00:00`);
    max.setDate(max.getDate() + 1);
    if (max < fim) {
      // mantém `fim` = hoje só se as notas forem recentes; senão usa max+1.
    }
  }

  const ptaxByCcy: Record<string, RatePoint[]> = {};
  await Promise.all(
    Array.from(ccys).map(async (c) => {
      ptaxByCcy[c] = await fetchPtaxSeries(PTAX_SERIES[c]!, ini, fim);
    }),
  );

  return (input) => computeConversion(input, { ref, fxMode, fixedRates, ptaxByCcy });
}
