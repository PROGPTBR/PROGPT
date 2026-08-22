// "Buscar preço e NCM aproximado" — backlog do diretor (2026-08-19, ver
// docs/product/backlog-diretor-2026-08-19.md, Batch G). Quando um item da
// Pesquisa de Preços não tem amostra na base de compras públicas (CATMAT),
// oferece uma estimativa via busca web da OpenAI (mesmo mecanismo de
// lib/fiscal/reputacao.ts) — preço de mercado aproximado + NCM sugerido.
//
// SEMPRE indicativo/não-oficial: sem amostra pública para confirmar, o preço
// pode variar e o NCM precisa ser validado com o fornecedor/cadastro fiscal.
// Fail-soft e desligável (PRECOS_WEBSEARCH='false'). NUNCA lança pro caller.

import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';

const TIMEOUT_MS = 25_000;

export function isPrecosAproximadoEnabled(): boolean {
  return process.env.PRECOS_WEBSEARCH !== 'false' && !!process.env.OPENAI_API_KEY;
}

const FonteSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  url: z.string().trim().min(1).max(500),
});

const PrecoAproximadoSchema = z.object({
  precoUnitario: z.number().positive().nullable().default(null),
  unidade: z.string().trim().max(40).nullable().default(null),
  ncm: z.string().trim().max(20).nullable().default(null),
  ncmDescricao: z.string().trim().max(300).nullable().default(null),
  fontes: z.array(FonteSchema).max(5).default([]),
  confianca: z.number().min(0).max(1).default(0),
  observacao: z.string().trim().max(500).default(''),
});

export type PrecoAproximadoResult = {
  enabled: boolean;
  available: boolean;
  precoUnitario: number | null;
  moeda: 'BRL';
  unidade: string | null;
  ncm: string | null;
  ncmDescricao: string | null;
  fontes: { titulo: string; url: string }[];
  confianca: number;
  observacao: string;
  consultadoEm: string; // ISO timestamp da consulta
  error?: string;
};

function emptyResult(enabled: boolean): PrecoAproximadoResult {
  return {
    enabled,
    available: false,
    precoUnitario: null,
    moeda: 'BRL',
    unidade: null,
    ncm: null,
    ncmDescricao: null,
    fontes: [],
    confianca: 0,
    observacao: '',
    consultadoEm: new Date().toISOString(),
  };
}

function buildPrompt(descricao: string, unidade: string | undefined): string {
  return `Você é um analista de compras fazendo uma estimativa de preço de mercado E uma classificação fiscal NCM para um item que NÃO teve amostra suficiente na base pública de compras do governo brasileiro.

Item: "${descricao}"${unidade ? ` (unidade de fornecimento informada: ${unidade})` : ''}

Faça uma busca web para estimar:
1. Um preço de mercado unitário aproximado no Brasil, em reais (BRL), considerando faixas de varejo/atacado quando encontrar mais de uma fonte confiável.
2. O código NCM (Nomenclatura Comum do Mercosul, 8 dígitos) mais provável para este item e sua descrição oficial resumida.

Responda ESTRITAMENTE em JSON válido, sem markdown, sem code fence, sem texto fora do JSON, exatamente neste formato:
{"precoUnitario": <número em BRL ou null>, "unidade": "<unidade a que o preço se refere, ou null>", "ncm": "<8 dígitos ou null>", "ncmDescricao": "<descrição oficial resumida do NCM ou null>", "fontes": [{"titulo": "<nome da fonte>", "url": "<url>"}], "confianca": <0 a 1>, "observacao": "<1-2 frases sobre a variação de preço encontrada ou incerteza>"}

Regras:
- Baseie-se SOMENTE no que encontrar na busca web. NÃO invente. Se não encontrar preço confiável, "precoUnitario": null.
- Se não conseguir estimar o NCM com razoável confiança, "ncm": null e "ncmDescricao": null.
- "confianca" reflete sua confiança geral (baixa se só 1 fonte, fontes divergentes, ou item ambíguo).
- "fontes": até 3 fontes mais relevantes, com URL real encontrada na busca.`;
}

/** Extrai o primeiro objeto JSON `{...}` de um texto (tolera code fences/preâmbulo). */
function extractJsonObject(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, '').trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(stripped.slice(start, end + 1));
}

export async function buscarPrecoAproximado(input: {
  descricao: string;
  unidade?: string;
}): Promise<PrecoAproximadoResult> {
  const enabled = isPrecosAproximadoEnabled();
  const result = emptyResult(enabled);
  if (!enabled) return result;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const ai = getOpenAI();
    const model = getOpenAIModel('routing');
    const res = await ai.responses.create(
      {
        model,
        tools: [{ type: 'web_search' } as never],
        input: buildPrompt(input.descricao, input.unidade),
      },
      { signal: controller.signal },
    );
    const out = res as {
      output_text?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-pesquisa-precos-aproximado',
      model,
      tokensIn: out.usage?.input_tokens ?? 0,
      tokensOut: out.usage?.output_tokens ?? 0,
      metadata: { web_search: true },
    });

    const parsed = PrecoAproximadoSchema.parse(extractJsonObject(out.output_text ?? ''));
    result.precoUnitario = parsed.precoUnitario;
    result.unidade = parsed.unidade;
    result.ncm = parsed.ncm;
    result.ncmDescricao = parsed.ncmDescricao;
    result.fontes = parsed.fontes;
    result.confianca = parsed.confianca;
    result.observacao = parsed.observacao;
    result.available = parsed.precoUnitario != null || parsed.ncm != null;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
  return result;
}
