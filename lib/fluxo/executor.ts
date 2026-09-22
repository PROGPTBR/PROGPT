import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { requireEnv } from '@/lib/env';
import { getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { analyzeComprador } from '@/lib/assistants/comprador';
import { consultarCnpj, riskScoreSupplier, isFiscalEnabled } from '@/lib/fiscal/client';

import { FLUXO_SYSTEM_PROMPT, buildStagePrompt } from './prompt';
import type { FluxoStage } from './stages';
import { FluxoStageOutputSchema, type FluxoContexto, type FluxoStageOutput } from './types';

// Execução de uma etapa do Fluxo Automatizado de Compras.
//
// Diferente do Proc2Pay (que re-implementa Kraljic e RFP em prompts próprios),
// aqui as etapas que já têm implementação testada no produto REUSAM essa
// implementação: a etapa 5 chama o Equalizador de Propostas e a etapa 3
// consulta a situação fiscal real. O LLM genérico é o fallback, não a regra.

const MAX_CNPJS = 5;

/** CNPJs soltos no texto (com ou sem máscara). */
export function extrairCnpjs(texto: string): string[] {
  const achados = texto.match(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) ?? [];
  const limpos = achados.map((c) => c.replace(/\D/g, '')).filter((c) => c.length === 14);
  return [...new Set(limpos)].slice(0, MAX_CNPJS);
}

/** Consulta fiscal dos CNPJs citados (etapa 3). Fail-soft: serviço fora ⇒
 *  a etapa roda sem o bloco, nunca quebra o processo. */
async function enriquecerFornecedores(texto: string): Promise<string | null> {
  if (!isFiscalEnabled()) return null;

  const cnpjs = extrairCnpjs(texto);
  if (cnpjs.length === 0) return null;

  const linhas: string[] = [];

  for (const cnpj of cnpjs) {
    try {
      const [cadastro, risco] = await Promise.all([
        consultarCnpj(cnpj).catch(() => null),
        riskScoreSupplier(cnpj).catch(() => null),
      ]);

      if (!cadastro && !risco) continue;

      linhas.push(
        [
          `CNPJ ${cnpj}`,
          cadastro?.razao_social ? `Razão social: ${cadastro.razao_social}` : '',
          cadastro?.situacao_cadastral ? `Situação cadastral: ${cadastro.situacao_cadastral}` : '',
          cadastro?.endereco?.uf ? `UF: ${cadastro.endereco.uf}` : '',
          risco?.score != null ? `Score de risco: ${risco.score}` : '',
          risco?.risco ? `Nível de risco: ${risco.risco}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      );
    } catch {
      // ignora este CNPJ e segue com os demais
    }
  }

  return linhas.length ? linhas.join('\n') : null;
}

/** Etapa 5 pelo Equalizador de Propostas (mesma engine do /assistants/comprador).
 *  Só roda quando o comprador colou propostas de verdade. */
async function equalizarPropostas(args: {
  propostas: string;
  escopo: string;
  pedidoCotacao: string;
  userId: string;
}): Promise<FluxoStageOutput | null> {
  try {
    const { result, usage, model } = await analyzeComprador({
      propostas: args.propostas.slice(0, 60000),
      escopo: args.escopo.slice(0, 8000),
      pedidoCotacao: args.pedidoCotacao.slice(0, 60000),
      politica: '',
    });

    void recordApiUsage({
      provider: 'openai',
      operation: 'fluxo-analise-equalizacao',
      model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      tokensCached: usage.tokensCached,
      callCount: 1,
      userId: args.userId,
    });

    return {
      resumo: result.resumo,
      campos: [
        { rotulo: 'Fornecedor recomendado', valor: result.recomendacao_fornecedor },
        { rotulo: 'Justificativa', valor: result.justificativa },
      ],
      itens: result.ranking.map((r) => ({
        titulo: r.fornecedor,
        detalhe: [
          `Custo total comparável: ${r.custo_total ? `R$ ${r.custo_total}` : 'não informado'}`,
          `Preço: ${r.preco}`,
          `Frete: ${r.frete}`,
          `Impostos: ${r.impostos}`,
          `Prazo: ${r.prazo_entrega}`,
          `Pagamento: ${r.condicao_pagamento}`,
          r.observacoes,
        ]
          .filter(Boolean)
          .join(' · '),
      })),
      pontos_de_revisao: result.pontos_negociacao,
      alertas: [...result.alertas, ...result.desvios_politica],
      saida: `Proposta recomendada: ${result.recomendacao_fornecedor}`,
    };
  } catch (err) {
    console.error('[fluxo] equalização falhou, caindo no LLM genérico:', err);
    return null;
  }
}

export async function executarEtapa(args: {
  stage: FluxoStage;
  requisicao: string;
  contexto: FluxoContexto;
  /** Texto que o comprador colou para esta etapa. */
  entrada?: string;
  /** Correção pedida num AJUSTAR anterior desta mesma etapa. */
  ajuste?: string | null;
  userId: string;
}): Promise<FluxoStageOutput> {
  const { stage, requisicao, contexto, entrada = '', ajuste, userId } = args;

  // --- Caminhos com implementação dedicada ---------------------------------

  if (stage.id === 'analise' && entrada.trim().length > 0) {
    const equalizado = await equalizarPropostas({
      propostas: entrada,
      escopo: requisicao,
      pedidoCotacao: contexto.rfq?.resumo ?? '',
      userId,
    });
    if (equalizado) return equalizado;
  }

  const enriquecimento =
    stage.id === 'fornecedores'
      ? await enriquecerFornecedores(`${entrada}\n${requisicao}`).catch(() => null)
      : null;

  // --- Caminho geral: LLM sobre a etapa ------------------------------------

  const openai = createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
  const model = getOpenAIModel('generation');

  const user = [
    buildStagePrompt({ stage, requisicao, contexto, ajuste, enriquecimento }),
    entrada.trim()
      ? `\n## ${stage.entrada_do_usuario.rotulo} (informado pelo comprador)\n${entrada.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const out = await generateObject({
    model: openai(model),
    system: FLUXO_SYSTEM_PROMPT,
    schema: FluxoStageOutputSchema,
    messages: [{ role: 'user', content: user }],
  });

  const tokensCached = (() => {
    const v = out.providerMetadata?.openai?.cachedPromptTokens;
    return typeof v === 'number' ? v : 0;
  })();

  void recordApiUsage({
    provider: 'openai',
    operation: `fluxo-etapa-${stage.id}`,
    model,
    tokensIn: out.usage.promptTokens,
    tokensOut: out.usage.completionTokens,
    tokensCached,
    callCount: 1,
    userId,
  });

  return out.object;
}
