// Preço de referência a partir das compras públicas (Compras.gov.br — módulo
// "Pesquisa de Preço · Preços Praticados"). Dois passos:
//
//   1. buscarCatmat(texto): resolve a descrição livre do item num código CATMAT.
//      Como o catálogo NÃO tem busca textual, navegamos a hierarquia
//      Classe → PDM → Item com o LLM escolhendo em cada nível (padrão do
//      lib/suppliers/cnae-classifier: candidatos → LLM pick). Fail-soft.
//   2. precoReferencia(codigoItem): puxa os preços praticados do item e calcula
//      estatística ROBUSTA (mediana + IQR + descarte de outliers) — preços
//      públicos têm outliers (compra emergencial), então média simples mente.
//
// Contrato em docs/product/govdata-api-contract.md.

import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { govGet } from './client';
import { cached } from './cache';
import type { ComprasPage } from './types';
import {
  listClasses,
  listPdms,
  listItemsByPdm,
  type CatmatItem,
} from './catalog';

// ── Estatística robusta (núcleo testável) ───────────────────────────────────

/** Percentil por interpolação linear (método "linear", igual numpy default). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export interface PriceStats {
  mediana: number;
  p25: number;
  p75: number;
  min: number;
  max: number;
  n: number; // amostras após filtrar outliers
  nBruto: number; // amostras válidas antes do filtro
  outliersRemovidos: number;
}

/**
 * Estatística robusta de uma lista de preços. Descarta valores não positivos /
 * inválidos, remove outliers via IQR (1.5×) e calcula sobre o conjunto filtrado.
 * Retorna null se não houver amostra válida.
 */
export function computePriceStats(valores: number[]): PriceStats | null {
  const limpos = valores.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (limpos.length === 0) return null;

  const q1 = percentile(limpos, 0.25);
  const q3 = percentile(limpos, 0.75);
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const filtrados = limpos.filter((v) => v >= lower && v <= upper);
  // Filtro só vale se ainda sobrar amostra (proteção contra IQR=0 degenerar).
  const base = filtrados.length > 0 ? filtrados : limpos;

  return {
    mediana: round2(percentile(base, 0.5)),
    p25: round2(percentile(base, 0.25)),
    p75: round2(percentile(base, 0.75)),
    min: round2(base[0]!),
    max: round2(base[base.length - 1]!),
    n: base.length,
    nBruto: limpos.length,
    outliersRemovidos: limpos.length - base.length,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Resolução texto → código CATMAT (LLM pick por nível) ─────────────────────

const PICK_TIMEOUT_MS = 9_000;

export interface CatmatMatch {
  codigoItem: number;
  descricaoItem: string;
  codigoClasse: number;
  nomeClasse: string;
  codigoPdm: number;
  nomePdm: string;
  confianca: number;
  rationale: string;
}

type PickCandidate = { codigo: number; nome: string };

async function llmPick(
  texto: string,
  nivel: 'classe' | 'PDM' | 'item',
  candidatos: PickCandidate[],
): Promise<{ codigo: number | null; confianca: number; rationale: string } | null> {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1)
    return { codigo: candidatos[0]!.codigo, confianca: 0.6, rationale: 'único candidato' };

  const ai = getOpenAI();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PICK_TIMEOUT_MS);
  const lista = candidatos.map((c) => `${c.codigo} — ${c.nome}`).join('\n');

  try {
    const res = await ai.chat.completions.create(
      {
        model: getOpenAIModel(), // routing tier (barato)
        messages: [
          {
            role: 'system',
            content: `Você mapeia a descrição de um item de compra para o catálogo de materiais do governo (CATMAT). Escolha, da lista de candidatos (nível: ${nivel}), o código que MELHOR representa o item.

Responda SEMPRE JSON estrito: {"codigo": <número ou null>, "confianca": <0..1>, "rationale": "<1 frase PT-BR>"}.
- Prefira o candidato mais específico que ainda cobre o item.
- Se NENHUM candidato encaixa, retorne codigo=null e confianca=0.
- Não invente códigos fora da lista.`,
          },
          {
            role: 'user',
            content: `Item desejado: "${texto}"\n\nCandidatos (${nivel}):\n${lista}`,
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 200,
      },
      { signal: controller.signal },
    );
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? '{}') as {
      codigo?: number | null;
      confianca?: number;
      rationale?: string;
    };
    void recordApiUsage({
      provider: 'openai',
      operation: 'govdata-catmat-pick',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: { nivel },
    });
    const codigo =
      parsed.codigo != null && candidatos.some((c) => c.codigo === Number(parsed.codigo))
        ? Number(parsed.codigo)
        : null;
    return {
      codigo,
      confianca: typeof parsed.confianca === 'number' ? parsed.confianca : 0,
      rationale: parsed.rationale ?? '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a descrição livre de um item num código CATMAT, navegando
 * Classe → PDM → Item com o LLM escolhendo em cada nível. Fail-soft: qualquer
 * falha (LLM, API, nada encaixa) retorna null e o assistente sinaliza.
 */
export async function buscarCatmat(texto: string): Promise<CatmatMatch | null> {
  const limpo = texto.trim();
  if (!limpo) return null;
  try {
    const classes = await listClasses();
    const pickClasse = await llmPick(
      limpo,
      'classe',
      classes.map((c) => ({ codigo: c.codigoClasse, nome: c.nomeClasse })),
    );
    if (!pickClasse?.codigo) return null;
    const classe = classes.find((c) => c.codigoClasse === pickClasse.codigo)!;

    const pdms = await listPdms(classe.codigoClasse);
    const pickPdm = await llmPick(
      limpo,
      'PDM',
      pdms.map((p) => ({ codigo: p.codigoPdm, nome: p.nomePdm })),
    );
    if (!pickPdm?.codigo) return null;
    const pdm = pdms.find((p) => p.codigoPdm === pickPdm.codigo)!;

    const itens = await listItemsByPdm(pdm.codigoPdm);
    if (itens.length === 0) return null;
    const pickItem = await llmPick(
      limpo,
      'item',
      itens.map((i) => ({ codigo: i.codigoItem, nome: i.descricaoItem.slice(0, 120) })),
    );
    const item: CatmatItem =
      (pickItem?.codigo && itens.find((i) => i.codigoItem === pickItem.codigo)) || itens[0]!;

    // Confiança composta (pior elo da cadeia).
    const confianca = Math.min(
      pickClasse.confianca || 0.5,
      pickPdm.confianca || 0.5,
      pickItem?.confianca || 0.5,
    );

    return {
      codigoItem: item.codigoItem,
      descricaoItem: item.descricaoItem,
      codigoClasse: classe.codigoClasse,
      nomeClasse: classe.nomeClasse,
      codigoPdm: pdm.codigoPdm,
      nomePdm: pdm.nomePdm,
      confianca,
      rationale: pickItem?.rationale || pickPdm.rationale || pickClasse.rationale,
    };
  } catch {
    return null;
  }
}

// ── Sugestão de itens do catálogo (autocomplete CATMAT) ──────────────────────
// O catálogo NÃO tem busca textual (ver docs/product/govdata-api-contract.md),
// então navegamos Classe → PDM via LLM (2 picks, em vez dos 3 do buscarCatmat) e
// devolvemos os itens REAIS do PDM pro usuário escolher. Tira o pick mais
// arriscado (o do item, hoje às cegas) e entrega a desambiguação pro humano —
// quem escolhe trava o codigoItem e o preço sai sem mismatch.

export interface CatmatSuggestion {
  codigoItem: number;
  descricaoItem: string;
}

export interface CatmatSuggestResult {
  codigoClasse: number;
  nomeClasse: string;
  codigoPdm: number;
  nomePdm: string;
  itens: CatmatSuggestion[];
}

/** Normaliza pra comparação: minúsculas, sem acento, tokens alfanuméricos ≥2. */
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

/**
 * Rank local (sem custo de LLM) dos itens do PDM pela sobreposição de tokens com
 * o texto digitado. Coloca os mais aderentes no topo; empate desempata pela
 * descrição mais curta (costuma ser a forma canônica). Itens sem match ficam ao
 * final (o PDM ainda pode estar certo — o usuário varre). Retorna até `limit`.
 */
export function rankByRelevance(
  texto: string,
  itens: CatmatSuggestion[],
  limit: number,
): CatmatSuggestion[] {
  const q = tokenize(texto);
  const scored = itens.map((item, idx) => {
    const toks = new Set(tokenize(item.descricaoItem));
    const score = q.reduce((acc, t) => acc + (toks.has(t) ? 1 : 0), 0);
    return { item, idx, score, len: item.descricaoItem.length };
  });
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.len !== b.len) return a.len - b.len;
    return a.idx - b.idx; // estável
  });
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Sugere itens do catálogo CATMAT para uma descrição livre: LLM escolhe a Classe
 * e o PDM, e devolvemos os itens daquele PDM rankeados localmente. Fail-soft:
 * qualquer falha (LLM, API, govdata off, nada encaixa) retorna null e o form
 * apenas não mostra sugestões (o auto-resolve no submit segue como rede).
 */
export async function suggestCatmatItems(
  texto: string,
  opts: { limit?: number } = {},
): Promise<CatmatSuggestResult | null> {
  const limpo = texto.trim();
  if (limpo.length < 3) return null;
  const limit = opts.limit ?? 15;
  try {
    const classes = await listClasses();
    const pickClasse = await llmPick(
      limpo,
      'classe',
      classes.map((c) => ({ codigo: c.codigoClasse, nome: c.nomeClasse })),
    );
    if (!pickClasse?.codigo) return null;
    const classe = classes.find((c) => c.codigoClasse === pickClasse.codigo)!;

    const pdms = await listPdms(classe.codigoClasse);
    const pickPdm = await llmPick(
      limpo,
      'PDM',
      pdms.map((p) => ({ codigo: p.codigoPdm, nome: p.nomePdm })),
    );
    if (!pickPdm?.codigo) return null;
    const pdm = pdms.find((p) => p.codigoPdm === pickPdm.codigo)!;

    const itens = await listItemsByPdm(pdm.codigoPdm);
    if (itens.length === 0) return null;

    return {
      codigoClasse: classe.codigoClasse,
      nomeClasse: classe.nomeClasse,
      codigoPdm: pdm.codigoPdm,
      nomePdm: pdm.nomePdm,
      itens: rankByRelevance(
        limpo,
        itens.map((i) => ({ codigoItem: i.codigoItem, descricaoItem: i.descricaoItem })),
        limit,
      ),
    };
  } catch {
    return null;
  }
}

// ── Preço de referência (preços praticados do item) ──────────────────────────

interface RawPreco {
  precoUnitario: number;
  quantidade: number;
  dataCompra: string;
  niFornecedor: string;
  nomeFornecedor: string;
  marca: string;
  siglaUnidadeFornecimento: string;
  nomeUnidadeMedida: string | null;
  estado: string;
  municipio: string;
  nomeOrgao: string;
}

export interface PrecoAmostra {
  precoUnitario: number;
  quantidade: number;
  dataCompra: string;
  unidade: string;
  fornecedor: string;
  marca: string;
  uf: string;
  municipio: string;
  orgao: string;
}

export interface PrecoReferencia {
  codigoItem: number;
  stats: PriceStats | null;
  amostras: PrecoAmostra[];
  totalAmostras: number;
}

function mapAmostra(r: RawPreco): PrecoAmostra {
  return {
    precoUnitario: Number(r.precoUnitario),
    quantidade: Number(r.quantidade),
    dataCompra: r.dataCompra,
    unidade: r.siglaUnidadeFornecimento || r.nomeUnidadeMedida || '',
    fornecedor: r.nomeFornecedor || '',
    marca: r.marca || '',
    uf: r.estado || '',
    municipio: r.municipio || '',
    orgao: r.nomeOrgao || '',
  };
}

/**
 * Preços praticados de um item CATMAT + estatística robusta. `uf` filtra por
 * estado (preços variam por região). `maxAmostras` corta a lista exposta (as
 * estatísticas usam tudo que veio). Fail-soft: erro → stats null, amostras [].
 */
export async function precoReferencia(
  codigoItem: number,
  opts: { uf?: string; maxAmostras?: number } = {},
): Promise<PrecoReferencia> {
  const { uf, maxAmostras = 25 } = opts;
  const cacheKey = `precos:${codigoItem}:${uf ?? 'BR'}`;
  try {
    const page = await cached(cacheKey, () =>
      govGet<ComprasPage<RawPreco>>('compras', '/modulo-pesquisa-preco/1_consultarMaterial', {
        codigoItemCatalogo: codigoItem,
        estado: uf,
        pagina: 1,
        tamanhoPagina: 500,
      }),
    );
    const amostras = (page.resultado ?? []).map(mapAmostra);
    const stats = computePriceStats(amostras.map((a) => a.precoUnitario));
    return {
      codigoItem,
      stats,
      amostras: amostras.slice(0, maxAmostras),
      totalAmostras: page.totalRegistros ?? amostras.length,
    };
  } catch {
    return { codigoItem, stats: null, amostras: [], totalAmostras: 0 };
  }
}
