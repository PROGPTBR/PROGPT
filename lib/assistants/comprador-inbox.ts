import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getOpenAIModel } from '@/lib/llm/openai';
import { z } from 'zod';
import { requireEnv } from '@/lib/env';
import type { CompradorResult } from './comprador';

// Robô Comprador — Caixa de Cotações. Rascunho de resposta ao fornecedor, no
// tom e nas regras do comprador, fundamentado na análise (TCO/alertas/desvios).
// SEMPRE passa por aprovação humana antes de enviar (regra do produto).

export type CompradorTone = 'cordial' | 'formal' | 'firme';

export type CompradorSettings = {
  tone: CompradorTone;
  rules: string;
  signature: string;
  approval_required: boolean;
  auto_draft: boolean;
};

export const DEFAULT_SETTINGS: CompradorSettings = {
  tone: 'cordial',
  rules: '',
  signature: '',
  approval_required: true,
  auto_draft: true,
};

export const ReplySchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1).describe('Corpo do e-mail pronto pra enviar, sem placeholders.'),
});
export type DraftedReply = z.infer<typeof ReplySchema>;

const TONE_HINT: Record<CompradorTone, string> = {
  cordial: 'cordial e profissional — parceiro, mas objetivo',
  formal: 'formal e protocolar',
  firme: 'firme e assertivo, deixando claras as condições, sem ser ríspido',
};

function isTone(v: unknown): v is CompradorTone {
  return v === 'cordial' || v === 'formal' || v === 'firme';
}

/** Normaliza um settings vindo do banco (qualquer shape) para o tipo seguro. */
export function normalizeSettings(row: Record<string, unknown> | null): CompradorSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    tone: isTone(row.tone) ? row.tone : 'cordial',
    rules: typeof row.rules === 'string' ? row.rules : '',
    signature: typeof row.signature === 'string' ? row.signature : '',
    approval_required: row.approval_required !== false,
    auto_draft: row.auto_draft !== false,
  };
}

export async function draftSupplierReply(input: {
  supplierName?: string | null;
  analysis: CompradorResult;
  settings: CompradorSettings;
  escopo?: string;
  instruction?: string;
}): Promise<{
  reply: DraftedReply;
  usage: { tokensIn: number; tokensOut: number; tokensCached: number };
  model: string;
}> {
  const { supplierName, analysis, settings, escopo, instruction } = input;
  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');

  const system = `Você é o Robô Comprador da 2B Supply / PROGPT redigindo um e-mail de RESPOSTA a um fornecedor, em nome do comprador.

Tom: ${TONE_HINT[settings.tone]}.
Regras do comprador (respeite SEMPRE): ${settings.rules.trim() || '(nenhuma regra específica)'}

Princípios:
- Seja claro, educado e acionável. Peça APENAS dados realmente faltantes (com base nos alertas/desvios).
- Ao negociar, fundamente em fatos da análise (preço fora da curva, prazo, condição de pagamento) — nunca invente números.
- NUNCA prometa fechamento/pedido — toda decisão depende de aprovação interna de Compras.
- Português do Brasil, sem placeholders ("[nome]", "[empresa]"): escreva o texto final.
- Se houver assinatura fornecida, encerre com ela.`;

  const user = `FORNECEDOR: ${supplierName || 'Prezados'}
ESCOPO/REQUISIÇÃO: ${escopo?.trim() || '(não detalhado)'}
INTENÇÃO DO COMPRADOR: ${instruction?.trim() || '(decida pela análise: priorize pedir dados faltantes e abrir negociação dos pontos levantados)'}

— ANÁLISE —
Resumo: ${analysis.resumo}
Recomendado: ${analysis.recomendacao_fornecedor}
Alertas: ${analysis.alertas.join(' | ') || '—'}
Desvios de política: ${analysis.desvios_politica.join(' | ') || '—'}
Pontos de negociação: ${analysis.pontos_negociacao.join(' | ') || '—'}

ASSINATURA: ${settings.signature.trim() || '(use "Atenciosamente, Equipe de Compras")'}

Redija o e-mail de resposta (subject curto + body pronto pra enviar).`;

  const out = await generateObject({
    model: openai(model),
    system,
    schema: ReplySchema,
    messages: [{ role: 'user', content: user }],
  });

  const tokensCached = (() => {
    const v = out.providerMetadata?.openai?.cachedPromptTokens;
    return typeof v === 'number' ? v : 0;
  })();

  return {
    reply: out.object,
    usage: {
      tokensIn: out.usage.promptTokens,
      tokensOut: out.usage.completionTokens,
      tokensCached,
    },
    model,
  };
}
