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
  IPCA_MENSAL: 433,
  CAMBIO_USD: 1,
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
