// Indicadores econômicos brasileiros via BACEN SGS (sub-projeto 37, fase 3).
// Séries públicas, sem chave: 432=Meta Selic, 433=IPCA mensal, 1=câmbio USD.
// Fail-soft: qualquer falha → indicador null; nunca derruba o fluxo.
// Contrato em docs/product/govdata-api-contract.md.

import { govGet } from './client';
import { cached } from './cache';
import type { BacenPonto } from './types';

const TTL_6H = 6 * 60 * 60 * 1000; // indicadores mudam no máx. 1×/dia

export const SGS = {
  SELIC_META: 432,
  CDI: 4389, // CDI anualizado base 252 (% a.a.)
  IPCA_MENSAL: 433,
  IGPM_MENSAL: 189,
  CAMBIO_USD: 1,
  CAMBIO_EUR: 21619, // euro (venda)
} as const;

export interface Indicador {
  codigo: number;
  nome: string;
  valor: number;
  unidade: string;
  data: string; // dd/MM/yyyy
}

export interface IndicadoresAtuais {
  selic: Indicador | null;
  ipca12m: Indicador | null;
  cambioUsd: Indicador | null;
}

/** Converte o `valor` string do BACEN (ponto OU vírgula decimal) em número. */
export function parseBacenNumber(s: string): number | null {
  const t = String(s).trim().replace(',', '.');
  if (t === '') return null; // Number('') é 0, não NaN
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Compõe N variações percentuais mensais num acumulado: (Π(1+vi/100) − 1)·100. */
export function accumulate12m(mensais: number[]): number | null {
  if (mensais.length === 0) return null;
  const fator = mensais.reduce((acc, v) => acc * (1 + v / 100), 1);
  return (fator - 1) * 100;
}

async function ultimos(codigo: number, n: number): Promise<BacenPonto[]> {
  return cached(
    `bacen:${codigo}:${n}`,
    () =>
      govGet<BacenPonto[]>('bacen', `/serie/bcdata.sgs.${codigo}/dados/ultimos/${n}`, {
        formato: 'json',
      }),
    TTL_6H,
  );
}

async function ultimoValor(codigo: number): Promise<BacenPonto | null> {
  try {
    const pts = await ultimos(codigo, 1);
    return pts[0] ?? null;
  } catch {
    return null;
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Selic meta, IPCA acumulado 12m e câmbio USD atuais. Cada um fail-soft. */
export async function indicadoresAtuais(): Promise<IndicadoresAtuais> {
  const [selicP, ipcaP, usdP] = await Promise.allSettled([
    ultimoValor(SGS.SELIC_META),
    ultimos(SGS.IPCA_MENSAL, 12),
    ultimoValor(SGS.CAMBIO_USD),
  ]);

  const selicPt = selicP.status === 'fulfilled' ? selicP.value : null;
  const selicVal = selicPt ? parseBacenNumber(selicPt.valor) : null;
  const selic: Indicador | null =
    selicPt && selicVal != null
      ? { codigo: SGS.SELIC_META, nome: 'Selic (meta)', valor: selicVal, unidade: '% a.a.', data: selicPt.data }
      : null;

  let ipca12m: Indicador | null = null;
  if (ipcaP.status === 'fulfilled' && ipcaP.value.length > 0) {
    const mensais = ipcaP.value
      .map((p) => parseBacenNumber(p.valor))
      .filter((v): v is number => v != null);
    const acc = accumulate12m(mensais);
    if (acc != null) {
      ipca12m = {
        codigo: SGS.IPCA_MENSAL,
        nome: 'IPCA (acum. 12m)',
        valor: round2(acc),
        unidade: '%',
        data: ipcaP.value[ipcaP.value.length - 1]!.data,
      };
    }
  }

  const usdPt = usdP.status === 'fulfilled' ? usdP.value : null;
  const usdVal = usdPt ? parseBacenNumber(usdPt.valor) : null;
  const cambioUsd: Indicador | null =
    usdPt && usdVal != null
      ? { codigo: SGS.CAMBIO_USD, nome: 'Dólar (venda)', valor: usdVal, unidade: 'R$', data: usdPt.data }
      : null;

  return { selic, ipca12m, cambioUsd };
}

/** Série temporal bruta de um código SGS (para gráfico/contexto). */
export async function serie(codigo: number, meses: number): Promise<BacenPonto[]> {
  try {
    return await ultimos(codigo, meses);
  } catch {
    return [];
  }
}

// ── Painel de indicadores (dashboard) ───────────────────────────────────────

export interface PontoSerie {
  data: string;
  valor: number;
}

export type IndicadorTipo = 'taxa' | 'indice' | 'cambio';

export interface IndicadorCard {
  key: 'selic' | 'cdi' | 'ipca' | 'igpm' | 'usd' | 'eur';
  nome: string;
  valor: number; // headline: nível atual (taxa/câmbio) ou acumulado 12m (índice)
  unidade: string; // '% a.a.' | '% (12m)' | 'R$'
  data: string;
  tipo: IndicadorTipo;
  descricao: string; // o que é, pra que serve em compras
  serie: PontoSerie[]; // para o sparkline
  serieLabel: string; // legenda do gráfico
  tendencia: 'up' | 'down' | 'flat';
}

export interface PainelIndicadores {
  disponivel: boolean;
  atualizadoEm: string; // data mais recente entre os cards
  cards: IndicadorCard[];
}

/** Tendência de uma série (último vs primeiro ponto). Pura/testável. */
export function tendencia(valores: number[]): 'up' | 'down' | 'flat' {
  if (valores.length < 2) return 'flat';
  const a = valores[0]!;
  const b = valores[valores.length - 1]!;
  const delta = b - a;
  const ref = Math.abs(a) || 1;
  if (Math.abs(delta) / ref < 0.001) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

function ddmmyyyy(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Janela por intervalo de datas. `ultimos/N` é capado para séries diárias
// (400 já em N=30); o range query (dataInicial/dataFinal) não tem esse limite.
async function serieRangeNum(codigo: number, meses: number): Promise<PontoSerie[]> {
  try {
    const fim = new Date();
    const ini = new Date(fim);
    ini.setMonth(ini.getMonth() - meses);
    const pts = await cached(
      `bacen-range:${codigo}:${meses}`,
      () =>
        govGet<BacenPonto[]>('bacen', `/serie/bcdata.sgs.${codigo}/dados`, {
          formato: 'json',
          dataInicial: ddmmyyyy(ini),
          dataFinal: ddmmyyyy(fim),
        }),
      TTL_6H,
    );
    return pts
      .map((p) => ({ data: p.data, valor: parseBacenNumber(p.valor) }))
      .filter((p): p is PontoSerie => p.valor != null);
  } catch {
    return [];
  }
}

/** Card de nível (taxa/câmbio): valor = último ponto, série = janela de `meses`. */
async function cardNivel(
  key: IndicadorCard['key'],
  codigo: number,
  meses: number,
  meta: { nome: string; unidade: string; tipo: IndicadorTipo; descricao: string; serieLabel: string },
): Promise<IndicadorCard | null> {
  const s = await serieRangeNum(codigo, meses);
  if (s.length === 0) return null;
  const last = s[s.length - 1]!;
  return {
    key,
    nome: meta.nome,
    valor: round2(last.valor),
    unidade: meta.unidade,
    data: last.data,
    tipo: meta.tipo,
    descricao: meta.descricao,
    serie: s,
    serieLabel: meta.serieLabel,
    tendencia: tendencia(s.map((p) => p.valor)),
  };
}

/** Card de índice (IPCA/IGP-M): valor = acumulado 12m, série = variação mensal. */
async function cardInflacao(
  key: IndicadorCard['key'],
  codigo: number,
  meta: { nome: string; descricao: string },
): Promise<IndicadorCard | null> {
  const s = await serieRangeNum(codigo, 18); // 18 meses de variação mensal
  if (s.length === 0) return null;
  const ultimos12 = s.slice(-12).map((p) => p.valor);
  const acc = accumulate12m(ultimos12);
  if (acc == null) return null;
  return {
    key,
    nome: meta.nome,
    valor: round2(acc),
    unidade: '% (12m)',
    data: s[s.length - 1]!.data,
    tipo: 'indice',
    descricao: meta.descricao,
    serie: s,
    serieLabel: 'variação mensal (%)',
    tendencia: tendencia(s.slice(-6).map((p) => p.valor)),
  };
}

/**
 * Painel completo de indicadores econômicos (6 cards com série pra gráfico).
 * Cada card é fail-soft (Promise.allSettled); o que falhar é omitido.
 */
export async function painelIndicadores(): Promise<PainelIndicadores> {
  const NIVEL = 4; // janela em meses para as séries de nível (diárias)
  const results = await Promise.allSettled([
    cardNivel('selic', SGS.SELIC_META, NIVEL, {
      nome: 'Selic (meta)',
      unidade: '% a.a.',
      tipo: 'taxa',
      descricao: 'Taxa básica de juros (Copom). Baliza o custo de capital e o financiamento de fornecedores.',
      serieLabel: '% a.a.',
    }),
    cardNivel('cdi', SGS.CDI, NIVEL, {
      nome: 'CDI',
      unidade: '% a.a.',
      tipo: 'taxa',
      descricao: 'Custo do dinheiro no interbancário (~Selic). Referência de aplicações e de juros embutidos em prazos.',
      serieLabel: '% a.a.',
    }),
    cardInflacao('ipca', SGS.IPCA_MENSAL, {
      nome: 'IPCA',
      descricao: 'Inflação oficial ao consumidor. Corrige preços e mede o ganho/perda real de savings.',
    }),
    cardInflacao('igpm', SGS.IGPM_MENSAL, {
      nome: 'IGP-M',
      descricao: 'Índice geral de preços. Indexador clássico de reajuste contratual (aluguéis, contratos longos).',
    }),
    cardNivel('usd', SGS.CAMBIO_USD, NIVEL, {
      nome: 'Dólar',
      unidade: 'R$',
      tipo: 'cambio',
      descricao: 'Câmbio USD (venda). Impacta itens importados e cláusulas atreladas a moeda.',
      serieLabel: 'R$',
    }),
    cardNivel('eur', SGS.CAMBIO_EUR, NIVEL, {
      nome: 'Euro',
      unidade: 'R$',
      tipo: 'cambio',
      descricao: 'Câmbio EUR (venda). Relevante para fornecedores e equipamentos europeus.',
      serieLabel: 'R$',
    }),
  ]);

  const cards = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((c): c is IndicadorCard => c != null);

  // data mais recente entre os cards (dd/MM/yyyy → compara por chave ISO)
  const atualizadoEm =
    cards
      .map((c) => c.data)
      .sort((a, b) => toIso(b).localeCompare(toIso(a)))[0] ?? '';

  return { disponivel: cards.length > 0, atualizadoEm, cards };
}

function toIso(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ddmmyyyy;
}

const BR = (n: number, frac = 2) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: frac, maximumFractionDigits: frac });

/** Resumo curto e falável dos indicadores (tool de voz / chat). */
export function resumoIndicadores(ind: IndicadoresAtuais): string {
  const partes: string[] = [];
  if (ind.selic) partes.push(`Selic em ${BR(ind.selic.valor)}% ao ano`);
  if (ind.ipca12m) partes.push(`IPCA acumulado em 12 meses de ${BR(ind.ipca12m.valor)}%`);
  if (ind.cambioUsd) partes.push(`dólar a R$ ${BR(ind.cambioUsd.valor)}`);
  if (partes.length === 0)
    return 'Não consegui consultar os indicadores econômicos no momento.';
  return `${partes.join(', ')}.`;
}

/** Bloco markdown dos indicadores (contexto pra assistentes). Vazio se nada. */
export function indicadoresMarkdown(ind: IndicadoresAtuais): string {
  const linhas: string[] = [];
  if (ind.selic) linhas.push(`- **Selic (meta)**: ${BR(ind.selic.valor)}% a.a. (${ind.selic.data})`);
  if (ind.ipca12m) linhas.push(`- **IPCA (acum. 12m)**: ${BR(ind.ipca12m.valor)}% (${ind.ipca12m.data})`);
  if (ind.cambioUsd) linhas.push(`- **Dólar (venda)**: R$ ${BR(ind.cambioUsd.valor, 4)} (${ind.cambioUsd.data})`);
  if (linhas.length === 0) return '';
  return `## Indicadores econômicos atuais (BACEN — contexto)\n\n${linhas.join('\n')}`;
}
