import { z } from 'zod';

// Mapa de Fornecedores da Operação (pedido do Alexandre, 2026-10-20, com o
// GRPCOM como caso: "na região de Curitiba quero os 50 fornecedores que
// podem atender a esta operação", e um mapa interativo na tela).
//
// Puro e sem servidor: usado na rota (montagem do resultado) e no navegador
// (mapa, lista, filtros). As partes com rede ficam em plano.ts, busca.ts,
// geocode.ts e relatorio.ts.

export const NIVEIS = ['alta', 'media', 'baixa'] as const;
export type Nivel = (typeof NIVEIS)[number];
export const NIVEL_LABEL: Record<Nivel, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

/** Plano que a IA monta a partir do pedido. Esquema todo obrigatório (modo estrito do structured output). */
export const PlanoSchema = z.object({
  empresa: z.string(),
  setor: z.string(),
  cidade: z.string(),
  uf: z.string(),
  totalFornecedores: z.number(),
  leitura: z.string(),
  categorias: z.array(
    z.object({
      nome: z.string(),
      tipo: z.enum(['CAPEX', 'OPEX']),
      criticidade: z.enum(NIVEIS),
      /** Quantos fornecedores o mercado tem para isso (baixa = poucos, precisa cotar mais e desenvolver). */
      concorrencia: z.enum(NIVEIS),
      termoBusca: z.string(),
      porque: z.string(),
    }),
  ),
});
export type Plano = z.infer<typeof PlanoSchema>;
export type CategoriaPlano = Plano['categorias'][number];

export type FornecedorMapa = {
  id: string;
  nome: string;
  categoria: string;
  site: string | null;
  telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  oQueVende: string | null;
  lat: number | null;
  lng: number | null;
  /** 'endereco' = ponto do endereço; 'cidade' = só a cidade (pino aproximado). */
  precisao: 'endereco' | 'cidade' | null;
};

export type ResultadoMapa = {
  pedido: string;
  plano: Plano;
  fornecedores: FornecedorMapa[];
  relatorio: string;
  geradoEm: string;
};

/** Evento da rota em NDJSON (uma linha por evento). */
export type EventoMapa =
  | { tipo: 'inicio'; runId: string }
  | { tipo: 'plano'; plano: Plano }
  | { tipo: 'categoria'; categoria: string; fornecedores: FornecedorMapa[] }
  | { tipo: 'pontos'; fornecedores: FornecedorMapa[] }
  | { tipo: 'texto'; delta: string }
  | { tipo: 'fim'; runId: string }
  | { tipo: 'erro'; mensagem: string };

/** Cor fixa por posição da categoria (mapa e legenda usam a mesma). */
export const CORES_CATEGORIA = [
  '#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308',
  '#14b8a6', '#ec4899', '#6366f1', '#84cc16', '#f43f5e', '#06b6d4',
] as const;

export function corDaCategoria(plano: Plano | null, categoria: string): string {
  const i = plano ? plano.categorias.findIndex((c) => c.nome === categoria) : -1;
  return CORES_CATEGORIA[(i < 0 ? 0 : i) % CORES_CATEGORIA.length]!;
}

export function normalizarNome(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\.?a\.?|sa|cia|comercio|servicos)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hostDe(site: string | null): string {
  if (!site) return '';
  try {
    return new URL(site).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Junta os fornecedores de todas as categorias sem repetir empresa (mesmo
 * site ou mesmo nome) e corta no total pedido, alternando entre as
 * categorias para nenhuma ficar de fora: 1º de cada, depois o 2º de cada...
 */
export function distribuirFornecedores(
  porCategoria: readonly { categoria: string; fornecedores: readonly FornecedorMapa[] }[],
  total: number,
): FornecedorMapa[] {
  const vistos = new Set<string>();
  const filas = porCategoria.map((c) =>
    c.fornecedores.filter((f) => {
      const chaves = [hostDe(f.site) && `site:${hostDe(f.site)}`, `nome:${normalizarNome(f.nome)}`].filter(
        Boolean,
      ) as string[];
      if (chaves.some((k) => vistos.has(k))) return false;
      chaves.forEach((k) => vistos.add(k));
      return true;
    }),
  );
  const out: FornecedorMapa[] = [];
  for (let rodada = 0; out.length < total; rodada++) {
    let algum = false;
    for (const fila of filas) {
      const f = fila[rodada];
      if (!f) continue;
      algum = true;
      out.push(f);
      if (out.length >= total) break;
    }
    if (!algum) break;
  }
  return out;
}

/** Quantos fornecedores pedir por categoria para chegar ao total com folga (duplicados e sem dados). */
export function porCategoriaAlvo(total: number, categorias: number): number {
  if (categorias <= 0) return 0;
  return Math.min(10, Math.max(4, Math.ceil((total / categorias) * 1.4)));
}

/** Total pedido: o número do pedido, entre 10 e 60 (padrão 50). */
export function totalSeguro(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(60, Math.max(10, Math.round(n)));
}

/** Planilha CSV (separador ";" e BOM, abre direto no Excel em português). */
export function csvFornecedores(r: Pick<ResultadoMapa, 'fornecedores' | 'plano'>): string {
  const tipo = new Map(r.plano.categorias.map((c) => [c.nome, c.tipo]));
  const cab = ['Fornecedor', 'Categoria', 'CAPEX/OPEX', 'O que vende', 'Telefone', 'Site', 'Endereço', 'Bairro', 'CEP', 'Cidade', 'UF'];
  const esc = (v: string | null | undefined) => `"${(v ?? '').replace(/"/g, '""')}"`;
  const linhas = r.fornecedores.map((f) =>
    [f.nome, f.categoria, tipo.get(f.categoria) ?? '', f.oQueVende, f.telefone, f.site, f.endereco, f.bairro, f.cep, f.cidade, f.uf]
      .map(esc)
      .join(';'),
  );
  return '﻿' + [cab.map(esc).join(';'), ...linhas].join('\r\n');
}

// Tipos de negócio que ninguém "compra": quem escreve "emissora de TV em
// Curitiba" está descrevendo a própria operação. Ficam de fora de propósito os
// termos que também são produto ou categoria de compra (papelaria, fábrica,
// indústria, banco...): "papelaria em Manaus" é um item, e "fábrica em
// Joinville" é ambíguo, então cai na Busca.
const NEGOCIOS =
  'emissora|televis[aã]o|hospital|cl[ií]nica|laborat[oó]rio|construtora|incorporadora|usina|mineradora|' +
  'frigor[ií]fico|supermercado|hipermercado|hotel|resort|escola|col[eé]gio|universidade|faculdade|' +
  'shopping|aeroporto|cooperativa|prefeitura|restaurante|seguradora|' +
  'rede de (?:lojas|farm[aá]cias|hospitais|hot[eé]is|supermercados)';

// "emissora de TV em Curitiba", "uma construtora em Recife": o pedido começa pelo negócio.
const COMECA_PELO_NEGOCIO = new RegExp(
  `^\\s*(?:(?:a|o|uma|um|minha|meu|nossa|nosso)\\s+)?(?:${NEGOCIOS})\\b`,
);
// "para a minha emissora", "tenho um hospital": quem fala é o dono da operação.
const DONO_DO_NEGOCIO = new RegExp(
  `\\b(?:(?:minha|meu|nossa|nosso)\\s+|(?:tenho|temos|tocamos|administro|gerencio)\\s+(?:uma?\\s+)?)(?:${NEGOCIOS})\\b`,
);

/** Pedido parece mapear a operação inteira de uma empresa (vs. procurar um item). */
export function pareceMapaDaOperacao(pedido: string): boolean {
  const t = pedido.toLowerCase();
  if (t.length > 350) return true;
  if (COMECA_PELO_NEGOCIO.test(t) || DONO_DO_NEGOCIO.test(t)) return true;
  return /\b(\d{2,3})\s+fornecedores\b|opera[cç][aã]o|grupo|capex|opex|todos os fornecedores|para (esta|essa|a) empresa|meu setor/.test(t);
}