// Indicadores econômicos brasileiros via BACEN SGS (sub-projeto 37, fase 3).
// Séries públicas, sem chave: 432=Meta Selic, 433=IPCA mensal, 1=câmbio USD.
// Fail-soft: qualquer falha → indicador null; nunca derruba o fluxo.
// Contrato em docs/product/govdata-api-contract.md.

import { govGet } from './client';
import { cached } from './cache';
import type { BacenPonto } from './types';

const TTL_6H = 6 * 60 * 60 * 1000; // indicadores "atuais" (voz): mudam no máx. 1×/dia
// Painel/séries: TTL curto pra refletir o câmbio do dia (PTAX publica à tarde);
// o botão "Atualizar" do dashboard força bypass deste cache (clearByPrefix).
const TTL_PANEL = 60 * 60 * 1000; // 1h

export const SGS = {
  SELIC_META: 432,
  CDI: 4389, // CDI anualizado base 252 (% a.a.)
  IPCA_MENSAL: 433,
  IGPM_MENSAL: 189,
  CAMBIO_USD: 1,
  CAMBIO_EUR: 21619, // euro (venda)
  // Batch K (backlog do diretor 21/08) — confirmados via documento oficial do
  // BACEN ("Price Indices in Brazil", FAQ 02, bcb.gov.br) antes de commitar:
  // IGP-DI cita explicitamente "SGS 190" (nota do Chart 1, pág. 9); INCC cita
  // "SGS 192" (nota 5, pág. 16); IPA (Broad Producer Price, FGV) cita "SGS 7450"
  // (nota 3, pág. 15). Cross-checados ao vivo: 190/7450 correlacionam em
  // direção com 189 (IGP-M) mês a mês, consistente com IGP-DI = 60% IPA + 30%
  // IPC + 10% INCC (mesmo documento).
  IGP_DI_MENSAL: 190,
  INCC_MENSAL: 192,
  IPA_MENSAL: 7450,
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

export type IndicadorTipo = 'taxa' | 'indice' | 'cambio' | 'expectativa';

// Batch K — painel cresce por seções (backlog do diretor: "podemos ampliar os
// índices"). Juros/Câmbio e Inflação e reajuste já existiam implicitamente
// (6 cards originais); Custos setoriais e expectativas é nova.
export type IndicadorSecao = 'juros_cambio' | 'inflacao_reajuste' | 'custos_expectativas';

export const SECAO_LABELS: Record<IndicadorSecao, string> = {
  juros_cambio: 'Juros e câmbio',
  inflacao_reajuste: 'Inflação e reajuste contratual',
  custos_expectativas: 'Custos setoriais e expectativas',
};

export interface IndicadorCard {
  key: 'selic' | 'cdi' | 'ipca' | 'igpm' | 'usd' | 'eur' | 'igpdi' | 'incc' | 'ipa' | 'focus_ipca';
  nome: string;
  valor: number; // headline: nível atual (taxa/câmbio), acumulado 12m (índice) ou mediana Focus (expectativa)
  unidade: string; // '% a.a.' | '% (12m)' | 'R$' | '% (Focus 12m)'
  data: string;
  tipo: IndicadorTipo;
  descricao: string; // o que é, pra que serve em compras
  serie: PontoSerie[]; // para o sparkline
  serieLabel: string; // legenda do gráfico
  tendencia: 'up' | 'down' | 'flat';
  secao: IndicadorSecao;
  // Batch K — exigência do doc: registrar fonte, data da consulta, período,
  // abrangência e metodologia + link em cada indicador.
  fonte: string;
  fonteUrl: string;
  periodo: string; // periodicidade da coleta/apuração
  abrangencia: string;
  metodologia: string;
  consultadoEm: string; // ISO timestamp de quando o painel foi montado
}

export interface PainelIndicadores {
  disponivel: boolean;
  atualizadoEm: string; // data mais recente entre os cards
  cards: IndicadorCard[];
  // Batch K — dado curado estático (não vem de fetch), embutido na mesma
  // resposta pra o dashboard não precisar de rota nova.
  fontesReferenciadas: FonteReferenciada[];
  indicadorPorCategoria: IndicadorPorCategoria[];
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
      TTL_PANEL,
    );
    return pts
      .map((p) => ({ data: p.data, valor: parseBacenNumber(p.valor) }))
      .filter((p): p is PontoSerie => p.valor != null);
  } catch {
    return [];
  }
}

// Fonte/metodologia — BACEN SGS (todos os cards de nível e de índice vêm
// dessa base). `sgsFonte(codigo)` monta o link direto pra série (exigência do
// doc: link em cada indicador).
function sgsFonte(codigo: number, periodo: string, metodologia: string) {
  return {
    fonte: 'Banco Central do Brasil (SGS)',
    fonteUrl: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados`,
    periodo,
    abrangencia: 'Nacional',
    metodologia,
    consultadoEm: new Date().toISOString(),
  };
}

type CardMetaBase = { secao: IndicadorSecao; periodo: string; metodologia: string };

/** Card de nível (taxa/câmbio): valor = último ponto, série = janela de `meses`. */
async function cardNivel(
  key: IndicadorCard['key'],
  codigo: number,
  meses: number,
  meta: { nome: string; unidade: string; tipo: IndicadorTipo; descricao: string; serieLabel: string } & CardMetaBase,
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
    secao: meta.secao,
    ...sgsFonte(codigo, meta.periodo, meta.metodologia),
  };
}

/** Card de índice (IPCA/IGP-M/…): valor = acumulado 12m, série = variação mensal. */
async function cardInflacao(
  key: IndicadorCard['key'],
  codigo: number,
  meta: { nome: string; descricao: string } & CardMetaBase,
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
    secao: meta.secao,
    ...sgsFonte(codigo, meta.periodo, meta.metodologia),
  };
}

// ── BACEN Focus (Expectativas de Mercado) — Batch K, Tier 1 ────────────────
// OData público sem chave. Filtra por nome do indicador (não por código
// numérico) — elimina o risco de "chutar" um código SGS errado.

interface FocusRow {
  Data: string; // 'YYYY-MM-DD'
  Suavizada: string; // 'S' | 'N'
  Mediana: number;
}

function isoToDdmmyyyy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// O parser OData desse endpoint (Olinda/Expectativas) é não-conforme em dois
// pontos, confirmados ao vivo antes de commitar: (1) rejeita espaço
// url-encoded como '+' — exige '%20' literal; (2) rejeita vírgula
// url-encoded em `$select` — exige ',' literal. `URLSearchParams` (usado por
// `govGet`) faz as duas coisas "erradas" pra esse servidor (usa '+' e
// %-encoda a vírgula), então a query aqui é montada à mão. `$filter` com 3
// cláusulas (Indicador + Suavizada + baseCalculo) funciona nesse formato;
// times fora do padrão OData por servidor — documentado no contrato.
function focusODataQuery(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%2C/g, ',')}`)
    .join('&');
}

/** Últimos N dias úteis da mediana Focus de IPCA (expectativa 12 meses à frente). */
async function serieFocusIpca(n: number): Promise<PontoSerie[]> {
  try {
    const qs = focusODataQuery({
      '$filter': "Indicador eq 'IPCA' and Suavizada eq 'N' and baseCalculo eq 1",
      '$top': n,
      '$orderby': 'Data desc',
      '$select': 'Data,Suavizada,Mediana',
      '$format': 'json',
    });
    const rows = await cached(
      `focus-ipca-12m:${n}`,
      () => govGet<{ value: FocusRow[] }>('bacen_olinda', `/ExpectativasMercadoInflacao12Meses?${qs}`),
      TTL_PANEL,
    );
    return rows.value
      .map((r) => ({ data: isoToDdmmyyyy(r.Data), valor: r.Mediana }))
      .filter((p) => Number.isFinite(p.valor))
      .reverse(); // API devolve desc; série quer asc (mais antigo → mais recente)
  } catch {
    return [];
  }
}

/** Card de expectativa: mediana Focus de IPCA pros próximos 12 meses. */
async function cardFocusIpca(): Promise<IndicadorCard | null> {
  const s = await serieFocusIpca(30); // ~30 dias úteis ≈ 6 semanas
  if (s.length === 0) return null;
  const last = s[s.length - 1]!;
  return {
    key: 'focus_ipca',
    nome: 'IPCA (Focus, 12m à frente)',
    valor: round2(last.valor),
    unidade: '% (Focus 12m)',
    data: last.data,
    tipo: 'expectativa',
    descricao:
      'Mediana das projeções de mercado (Boletim Focus) para o IPCA acumulado nos próximos 12 meses. Útil para orçamento e cenários de reajuste futuro — diferente do IPCA realizado (já ocorrido).',
    serie: s,
    serieLabel: 'mediana Focus (%)',
    tendencia: tendencia(s.map((p) => p.valor)),
    secao: 'custos_expectativas',
    fonte: 'Banco Central do Brasil (Sistema Expectativas de Mercado — Focus)',
    fonteUrl: 'https://www3.bcb.gov.br/expectativas2/#/consultaSeriesEstatisticas',
    periodo: 'diário (dias úteis)',
    abrangencia: 'Nacional — pesquisa com bancos, gestoras e demais instituições',
    metodologia:
      'Mediana das respostas de instituições participantes do Sistema Expectativas de Mercado para o IPCA acumulado nos 12 meses seguintes à data de referência.',
    consultadoEm: new Date().toISOString(),
  };
}

/**
 * Painel completo de indicadores econômicos (10 cards com série pra gráfico,
 * agrupados em 3 seções — Batch K do backlog do diretor).
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
      secao: 'juros_cambio',
      periodo: 'a cada reunião do Copom (~45 dias)',
      metodologia: 'Meta definida pelo Comitê de Política Monetária (Copom) do Banco Central.',
    }),
    cardNivel('cdi', SGS.CDI, NIVEL, {
      nome: 'CDI',
      unidade: '% a.a.',
      tipo: 'taxa',
      descricao: 'Custo do dinheiro no interbancário (~Selic). Referência de aplicações e de juros embutidos em prazos.',
      serieLabel: '% a.a.',
      secao: 'juros_cambio',
      periodo: 'diário',
      metodologia: 'Taxa média dos Depósitos Interfinanceiros de um dia, anualizada em base 252 dias úteis.',
    }),
    cardNivel('usd', SGS.CAMBIO_USD, NIVEL, {
      nome: 'Dólar',
      unidade: 'R$',
      tipo: 'cambio',
      descricao: 'Câmbio USD (venda). Impacta itens importados e cláusulas atreladas a moeda.',
      serieLabel: 'R$',
      secao: 'juros_cambio',
      periodo: 'diário',
      metodologia: 'Taxa de câmbio livre, dólar americano, venda, PTAX.',
    }),
    cardNivel('eur', SGS.CAMBIO_EUR, NIVEL, {
      nome: 'Euro',
      unidade: 'R$',
      tipo: 'cambio',
      descricao: 'Câmbio EUR (venda). Relevante para fornecedores e equipamentos europeus.',
      serieLabel: 'R$',
      secao: 'juros_cambio',
      periodo: 'diário',
      metodologia: 'Taxa de câmbio livre, euro, venda, PTAX.',
    }),
    cardInflacao('ipca', SGS.IPCA_MENSAL, {
      nome: 'IPCA',
      descricao: 'Inflação oficial ao consumidor. Corrige preços e mede o ganho/perda real de savings.',
      secao: 'inflacao_reajuste',
      periodo: 'mensal (calendário do mês)',
      metodologia: 'IBGE — Índice Nacional de Preços ao Consumidor Amplo, referência do regime de metas de inflação.',
    }),
    cardInflacao('igpm', SGS.IGPM_MENSAL, {
      nome: 'IGP-M',
      descricao: 'Índice geral de preços. Indexador clássico de reajuste contratual (aluguéis, contratos longos).',
      secao: 'inflacao_reajuste',
      periodo: 'mensal (21 do mês anterior a 20 do mês de referência)',
      metodologia: 'FGV IBRE — média ponderada de IPA (60%), IPC (30%) e INCC (10%).',
    }),
    cardInflacao('igpdi', SGS.IGP_DI_MENSAL, {
      nome: 'IGP-DI',
      descricao: 'Índice geral de preços (disponibilidade interna). Referência tradicional pra reajuste de preços regulados e contratos.',
      secao: 'inflacao_reajuste',
      periodo: 'mensal (calendário do mês)',
      metodologia: 'FGV IBRE — mesma composição do IGP-M (IPA 60% + IPC 30% + INCC 10%), coleta no mês calendário.',
    }),
    cardInflacao('incc', SGS.INCC_MENSAL, {
      nome: 'INCC',
      descricao: 'Custo nacional da construção civil (mão de obra + materiais). Referência pra obras, reformas e contratos de construção.',
      secao: 'custos_expectativas',
      periodo: 'mensal (calendário do mês)',
      metodologia: 'FGV IBRE — média de 7 capitais, ponderando materiais/equipamentos/serviços (76%) e mão de obra (24%).',
    }),
    cardInflacao('ipa', SGS.IPA_MENSAL, {
      nome: 'IPA',
      descricao: 'Índice de preços ao produtor (atacado). Referência pra equipamentos industriais e insumos de produção.',
      secao: 'custos_expectativas',
      periodo: 'mensal (calendário do mês)',
      metodologia: 'FGV IBRE — Índice de Preços ao Produtor Amplo, produtos agrícolas e industriais nas etapas de produção.',
    }),
    cardFocusIpca(),
  ]);

  const cards = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((c): c is IndicadorCard => c != null);

  // data mais recente entre os cards (dd/MM/yyyy → compara por chave ISO)
  const atualizadoEm =
    cards
      .map((c) => c.data)
      .sort((a, b) => toIso(b).localeCompare(toIso(a)))[0] ?? '';

  return {
    disponivel: cards.length > 0,
    atualizadoEm,
    cards,
    fontesReferenciadas: FONTES_REFERENCIADAS,
    indicadorPorCategoria: INDICADOR_POR_CATEGORIA,
  };
}

function toIso(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ddmmyyyy;
}

// ── Série histórica por indicador (detalhe/gráfico/export) ───────────────────

// 'focus_ipca' fica de fora: não é uma série SGS por código numérico (vem do
// OData de Expectativas, filtrado por nome) — o drill-down de série histórica
// por enquanto cobre só os indicadores SGS. Ver Batch K no backlog do diretor.
export type IndicadorKey = Exclude<IndicadorCard['key'], 'focus_ipca'>;

/** Metadados por chave (fonte única do código SGS + rótulo da série + doc do Batch K). */
export const INDICADOR_META: Record<
  IndicadorKey,
  { codigo: number; nome: string; unidade: string; metodologia: string }
> = {
  selic: { codigo: SGS.SELIC_META, nome: 'Selic (meta)', unidade: '% a.a.', metodologia: 'Meta definida pelo Copom (Banco Central).' },
  cdi: { codigo: SGS.CDI, nome: 'CDI', unidade: '% a.a.', metodologia: 'Taxa média dos Depósitos Interfinanceiros de um dia, anualizada (base 252).' },
  ipca: { codigo: SGS.IPCA_MENSAL, nome: 'IPCA (variação mensal)', unidade: '%', metodologia: 'IBGE — Índice Nacional de Preços ao Consumidor Amplo.' },
  igpm: { codigo: SGS.IGPM_MENSAL, nome: 'IGP-M (variação mensal)', unidade: '%', metodologia: 'FGV IBRE — IPA (60%) + IPC (30%) + INCC (10%).' },
  usd: { codigo: SGS.CAMBIO_USD, nome: 'Dólar (venda)', unidade: 'R$', metodologia: 'Taxa de câmbio livre, dólar americano, venda, PTAX.' },
  eur: { codigo: SGS.CAMBIO_EUR, nome: 'Euro (venda)', unidade: 'R$', metodologia: 'Taxa de câmbio livre, euro, venda, PTAX.' },
  igpdi: { codigo: SGS.IGP_DI_MENSAL, nome: 'IGP-DI (variação mensal)', unidade: '%', metodologia: 'FGV IBRE — mesma composição do IGP-M, coleta no mês calendário.' },
  incc: { codigo: SGS.INCC_MENSAL, nome: 'INCC (variação mensal)', unidade: '%', metodologia: 'FGV IBRE — custo nacional da construção civil, 7 capitais.' },
  ipa: { codigo: SGS.IPA_MENSAL, nome: 'IPA (variação mensal)', unidade: '%', metodologia: 'FGV IBRE — Índice de Preços ao Produtor Amplo.' },
};

export function isIndicadorKey(k: string): k is IndicadorKey {
  return Object.prototype.hasOwnProperty.call(INDICADOR_META, k);
}

/** Série histórica de um indicador (por chave) numa janela de `meses`. Fail-soft. */
export async function serieIndicador(
  key: IndicadorKey,
  meses: number,
): Promise<PontoSerie[]> {
  return serieRangeNum(INDICADOR_META[key].codigo, meses);
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

// ── Fontes referenciadas (Batch K — Tier 2/3) ────────────────────────────────
// Fontes citadas no doc do diretor sem integração ao vivo nesta rodada: sem
// API estável (ANP/ANTT/CEPEA/Pink Sheet) ou API própria ainda não integrada
// (IBGE SIDRA, IpeaData, Comex Stat). Entregues como referência (link + o que
// cobre + aplicação em compras) em vez de scraping frágil — dado curado, não
// vem de fetch algum.

export interface FonteReferenciada {
  fonte: string;
  cobre: string;
  aplicacao: string;
  url: string;
}

export const FONTES_REFERENCIADAS: FonteReferenciada[] = [
  {
    fonte: 'IBGE — SIDRA',
    cobre: 'IPCA, INPC, IPP (Índice de Preços ao Produtor) e SINAPI',
    aplicacao: 'Inflação ao consumidor, custos industriais e insumos de construção civil.',
    url: 'https://sidra.ibge.gov.br',
  },
  {
    fonte: 'IpeaData',
    cobre: 'Séries econômicas, sociais e regionais de longo histórico',
    aplicacao: 'Pesquisas históricas e análises comparativas de preços/custos.',
    url: 'http://www.ipeadata.gov.br',
  },
  {
    fonte: 'ANP — dados abertos',
    cobre: 'Preços de diesel, gasolina, etanol e GLP por região/posto',
    aplicacao: 'Fretes, logística e reajuste de contratos de transporte.',
    url: 'https://www.gov.br/anp/pt-br/assuntos/precos-e-defesa-da-concorrencia/precos/levantamento-de-precos',
  },
  {
    fonte: 'ANTT — calculadora do piso mínimo do frete',
    cobre: 'Piso mínimo do frete rodoviário por eixo/carga',
    aplicacao: 'Referência obrigatória em contratação de transporte rodoviário de cargas.',
    url: 'https://pisominimo.antt.gov.br',
  },
  {
    fonte: 'Comex Stat (MDIC)',
    cobre: 'Importações e exportações por NCM, país e período',
    aplicacao: 'Análise de produtos importados e do mercado internacional de fornecedores.',
    url: 'https://comexstat.mdic.gov.br',
  },
  {
    fonte: 'CEPEA/Esalq-USP',
    cobre: 'Soja, milho, açúcar, café, carnes e outras commodities agrícolas',
    aplicacao: 'Compras de alimentos e insumos agrícolas.',
    url: 'https://www.cepea.esalq.usp.br',
  },
  {
    fonte: 'Banco Mundial — Commodity Markets (Pink Sheet)',
    cobre: 'Petróleo, metais, fertilizantes, energia e commodities internacionais',
    aplicacao: 'Análise de tendências internacionais de commodities.',
    url: 'https://www.worldbank.org/en/research/commodity-markets',
  },
];

// ── Qual indicador usar em cada compra (Batch K) ─────────────────────────────
// Tabela curada do doc do diretor — dado estático, não vem de API.

export interface IndicadorPorCategoria {
  categoria: string;
  referencia: string;
}

export const INDICADOR_POR_CATEGORIA: IndicadorPorCategoria[] = [
  { categoria: 'Material de escritório', referencia: 'Preços de mercado + Compras.gov.br + IPCA' },
  { categoria: 'Equipamento industrial', referencia: 'IPA + câmbio + índice da matéria-prima' },
  { categoria: 'Produto importado', referencia: 'PTAX (câmbio) + Comex Stat + commodity internacional' },
  { categoria: 'Construção civil', referencia: 'SINAPI + INCC' },
  { categoria: 'Transporte rodoviário', referencia: 'ANP (combustível) + calculadora do piso mínimo da ANTT' },
  { categoria: 'Alimentos', referencia: 'CEPEA + IPCA do grupo de alimentação' },
  { categoria: 'Serviços com mão de obra', referencia: 'Convenção coletiva + INPC ou IPCA' },
  { categoria: 'Contratos de aluguel', referencia: 'Índice definido no contrato, frequentemente IPCA ou IGP-M' },
];
