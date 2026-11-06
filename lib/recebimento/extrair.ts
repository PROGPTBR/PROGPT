import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

import { requireEnv } from '@/lib/env';
import { getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import type { NotaLida, PedidoInput } from './types';

// Leitura por IA do que não vem em XML (sub-projeto 95):
//  - a nota em PDF ou foto (DANFE), quando o fornecedor não manda o XML;
//  - o pedido de compra em documento, para não digitar item por item.
//
// Esquemas 100% obrigatórios (nulos em vez de opcionais): o tier de geração
// em produção liga o modo estrito do structured output (ver
// tests/lib/llm/structured-output-strict.test.ts).

export const NotaExtraidaSchema = z.object({
  numero: z.string().nullable(),
  serie: z.string().nullable(),
  chave: z.string().nullable(),
  emitente_nome: z.string().nullable(),
  emitente_cnpj: z.string().nullable(),
  data_emissao: z.string().nullable(),
  natureza: z.string().nullable(),
  valor_total: z.number().nullable(),
  itens: z.array(
    z.object({
      codigo: z.string().nullable(),
      descricao: z.string(),
      ncm: z.string().nullable(),
      cfop: z.string().nullable(),
      unidade: z.string().nullable(),
      quantidade: z.number().nullable(),
      valor_unitario: z.number().nullable(),
      valor_total: z.number().nullable(),
      icms_pct: z.number().nullable(),
      ipi_pct: z.number().nullable(),
    }),
  ),
});

const SYSTEM_NOTA = `Você lê o DANFE (a representação impressa da NF-e) de uma nota fiscal brasileira e devolve os dados exatamente como estão no documento.

- numero e serie da nota; chave de acesso (44 dígitos) se aparecer.
- emitente_nome e emitente_cnpj: quem EMITIU a nota (o fornecedor), não o destinatário.
- data_emissao no formato AAAA-MM-DD.
- natureza: o campo "natureza da operação".
- valor_total: o valor total da nota.
- itens: uma linha por produto do quadro "dados dos produtos", com código, descrição, NCM (8 dígitos), CFOP, unidade, quantidade, valor unitário, valor total do item, alíquota de ICMS e de IPI em % (ex.: 18 para 18%).

Copie os números como estão: não arredonde, não calcule, não invente. O que não aparecer volta null. Não use travessão.`;

export const PedidoExtraidoSchema = z.object({
  numero: z.string().nullable(),
  fornecedor_nome: z.string().nullable(),
  fornecedor_cnpj: z.string().nullable(),
  condicoes: z.string().nullable(),
  itens: z.array(
    z.object({
      codigo: z.string().nullable(),
      descricao: z.string(),
      ncm: z.string().nullable(),
      unidade: z.string().nullable(),
      quantidade: z.number().nullable(),
      valor_unitario: z.number().nullable(),
      icms_pct: z.number().nullable(),
      ipi_pct: z.number().nullable(),
    }),
  ),
});

const SYSTEM_PEDIDO = `Você lê um pedido de compra (ordem de compra, PO) brasileiro e devolve os dados como estão no documento.

- numero do pedido; fornecedor_nome e fornecedor_cnpj (o FORNECEDOR, não a empresa compradora).
- condicoes: prazo de entrega, condição de pagamento, frete e local de entrega, em até 3 frases.
- itens: uma linha por produto, com código, descrição, NCM, unidade, quantidade, valor unitário e as alíquotas de ICMS e IPI em % que o pedido informar (ex.: 18 para 18%).

Copie os números como estão. O que o pedido não disser volta null (nunca chute alíquota nem NCM). Não use travessão.`;

function modelo() {
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');
  return { model, provider: openai(model) };
}

function cached(meta: unknown): number {
  const v = (meta as { openai?: { cachedPromptTokens?: unknown } } | undefined)?.openai?.cachedPromptTokens;
  return typeof v === 'number' ? v : 0;
}

const s = (v: string | null | undefined) => (v ?? '').trim();

export async function extrairNotaDoTexto(texto: string, userId: string | null): Promise<NotaLida> {
  const { model, provider } = modelo();
  const out = await generateObject({
    model: provider,
    system: SYSTEM_NOTA,
    schema: NotaExtraidaSchema,
    messages: [{ role: 'user', content: texto.slice(0, 60_000) }],
  });

  void recordApiUsage({
    provider: 'openai',
    operation: 'recebimento-ler-nota',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    tokensCached: cached(out.providerMetadata),
    callCount: 1,
    userId,
  });

  const o = out.object;
  return {
    numero: s(o.numero),
    serie: s(o.serie),
    chave: s(o.chave).replace(/\D/g, ''),
    emitente_nome: s(o.emitente_nome),
    emitente_cnpj: s(o.emitente_cnpj),
    data_emissao: s(o.data_emissao).slice(0, 10),
    natureza: s(o.natureza),
    valor_total: o.valor_total,
    itens: o.itens
      .filter((i) => i.descricao.trim())
      .map((i) => ({
        codigo: s(i.codigo),
        descricao: i.descricao.trim(),
        ncm: s(i.ncm),
        cfop: s(i.cfop),
        unidade: s(i.unidade),
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
        valor_total: i.valor_total,
        icms_pct: i.icms_pct,
        ipi_pct: i.ipi_pct,
      })),
  };
}

export type PedidoExtraido = Pick<PedidoInput, 'numero' | 'fornecedor_nome' | 'fornecedor_cnpj' | 'condicoes' | 'itens'>;

export async function extrairPedidoDoTexto(texto: string, userId: string): Promise<PedidoExtraido> {
  const { model, provider } = modelo();
  const out = await generateObject({
    model: provider,
    system: SYSTEM_PEDIDO,
    schema: PedidoExtraidoSchema,
    messages: [{ role: 'user', content: texto.slice(0, 60_000) }],
  });

  void recordApiUsage({
    provider: 'openai',
    operation: 'recebimento-importar-pedido',
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    tokensCached: cached(out.providerMetadata),
    callCount: 1,
    userId,
  });

  const o = out.object;
  return {
    numero: s(o.numero),
    fornecedor_nome: s(o.fornecedor_nome),
    fornecedor_cnpj: s(o.fornecedor_cnpj),
    condicoes: s(o.condicoes),
    itens: o.itens
      .filter((i) => i.descricao.trim())
      .map((i) => ({
        codigo: s(i.codigo),
        descricao: i.descricao.trim().slice(0, 300),
        ncm: s(i.ncm),
        unidade: s(i.unidade) || 'UN',
        quantidade: i.quantidade && i.quantidade > 0 ? i.quantidade : 1,
        valor_unitario: i.valor_unitario && i.valor_unitario >= 0 ? i.valor_unitario : 0,
        icms_pct: i.icms_pct,
        ipi_pct: i.ipi_pct,
      })),
  };
}
