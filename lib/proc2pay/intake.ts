// Proc2Pay — estruturação da requisição a partir de texto livre (corpo de
// e-mail da produção colado, ou — numa fase seguinte — recebido via Resend
// Inbound). Transforma texto em RequisicaoPayload via tier de geração.

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getOpenAIModel } from '@/lib/llm/openai';
import { requireEnv } from '@/lib/env';
import { recordApiUsage } from '@/lib/observability/api-usage';
import type { RequisicaoPayload } from './types';

const Schema = z.object({
  solicitante: z.string().describe('Quem pediu / setor. "Não informado" se ausente.'),
  categoria: z.string().optional(),
  descricao: z.string().describe('Resumo do que precisa ser comprado e por quê.'),
  itens: z
    .array(
      z.object({
        descricao: z.string(),
        qtd: z.number().default(1),
        unidade: z.string().default('un'),
        especificacao: z.string().optional(),
      }),
    )
    .default([]),
  prazoDesejado: z.string().optional(),
  orcamentoEstimado: z.number().optional(),
  criticidade: z.enum(['baixa', 'media', 'alta']).optional(),
  titulo: z.string().describe('Título curto do processo (≤ 80 chars).'),
});

export type StructuredRequisicao = { requisicao: RequisicaoPayload; titulo: string };

/**
 * Estrutura um texto livre (e-mail da produção) numa requisição. Fail-soft:
 * em qualquer erro, devolve uma requisição mínima com o texto na descrição —
 * nunca derruba a abertura do processo.
 */
export async function structureRequisicaoFromText(
  text: string,
  userId?: string,
): Promise<StructuredRequisicao> {
  const clean = (text ?? '').trim().slice(0, 20000);
  const fallback: StructuredRequisicao = {
    requisicao: { solicitante: 'Não informado', descricao: clean || '(vazio)', itens: [] },
    titulo: clean.slice(0, 60) || 'Processo de compra',
  };
  if (!clean) return fallback;

  try {
    const model = getOpenAIModel('generation');
    const out = await generateObject({
      model: createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') })(model),
      schema: Schema,
      system:
        'Você é um analista de compras. Extraia uma requisição de compra estruturada a partir do e-mail/texto da área solicitante. Não invente itens nem quantidades que não estejam no texto — use defaults só quando o campo não existir.',
      messages: [{ role: 'user', content: `Estruture esta solicitação de compra:\n\n${clean}` }],
    });

    const cached = (() => {
      const v = out.providerMetadata?.openai?.cachedPromptTokens;
      return typeof v === 'number' ? v : 0;
    })();
    void recordApiUsage({
      provider: 'openai',
      operation: 'proc2pay-intake',
      model,
      tokensIn: out.usage.promptTokens,
      tokensOut: out.usage.completionTokens,
      tokensCached: cached,
      userId: userId ?? null,
    });

    const o = out.object;
    return {
      requisicao: {
        solicitante: o.solicitante || 'Não informado',
        categoria: o.categoria,
        descricao: o.descricao || clean.slice(0, 200),
        itens: o.itens ?? [],
        prazoDesejado: o.prazoDesejado,
        orcamentoEstimado: o.orcamentoEstimado,
        criticidade: o.criticidade,
      },
      titulo: (o.titulo || o.descricao || 'Processo de compra').slice(0, 80),
    };
  } catch (err) {
    console.warn('[proc2pay/intake] structure failed, fallback:', err instanceof Error ? err.message : err);
    return fallback;
  }
}
