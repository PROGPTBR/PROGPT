// Proc2Pay — execução de cada etapa. Reusa o tier de geração (AI SDK
// generateObject, mesmo padrão de lib/assistants/comprador.ts) e o contexto
// carregado das etapas anteriores (handoff). A equalização reusa diretamente
// analyzeComprador (TCO real do Robô Comprador).

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { getOpenAIModel } from '@/lib/llm/openai';
import { requireEnv } from '@/lib/env';
import { analyzeComprador } from '@/lib/assistants/comprador';
import type { Proc2PayContext, RequisicaoPayload, StageId } from './types';

export type StagePayload = {
  propostas?: string; // texto colado das propostas (etapa 9, MVP manual)
  nota?: string;      // observação livre do comprador para a etapa
};

export type ExecResult = {
  output: unknown;        // vai para context[produces]
  artifactMd: string;     // documento/narrativa da etapa
  usage: { tokensIn: number; tokensOut: number; tokensCached: number };
  model: string;
  operation: string;      // rótulo p/ recordApiUsage
};

const ZERO_USAGE = { tokensIn: 0, tokensOut: 0, tokensCached: 0 };

function openaiClient() {
  return createOpenAI({ apiKey: requireEnv('OPENAI_API_KEY') });
}

function reqResumo(req: RequisicaoPayload | undefined): string {
  if (!req) return '(requisição não preenchida)';
  const itens = (req.itens ?? [])
    .map((i) => `- ${i.qtd} ${i.unidade} — ${i.descricao}${i.especificacao ? ` (${i.especificacao})` : ''}`)
    .join('\n');
  return [
    `Solicitante: ${req.solicitante}`,
    req.categoria ? `Categoria: ${req.categoria}` : '',
    req.criticidade ? `Criticidade: ${req.criticidade}` : '',
    req.prazoDesejado ? `Prazo desejado: ${req.prazoDesejado}` : '',
    req.orcamentoEstimado ? `Orçamento estimado: R$ ${req.orcamentoEstimado}` : '',
    `Descrição: ${req.descricao}`,
    itens ? `Itens:\n${itens}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const PERSONA = `Você é um especialista sênior em compras/procurement — um engenheiro que faz compras, fundamentado (Kraljic, Porter, Monczka, Cousins). Direto, prático, sem citar fontes. Responda em PT-BR.`;

const NarrativeSchema = z.object({
  markdown: z.string().describe('Documento/análise da etapa em markdown limpo.'),
  resumo: z.string().describe('Resumo de 1-2 frases do resultado da etapa.'),
});

async function runObject<T extends z.ZodTypeAny>(
  system: string,
  user: string,
  schema: T,
  operation: string,
): Promise<{ object: z.infer<T>; usage: ExecResult['usage']; model: string; operation: string }> {
  const model = getOpenAIModel('generation');
  const out = await generateObject({
    model: openaiClient()(model),
    system,
    schema,
    messages: [{ role: 'user', content: user }],
  });
  const cached = (() => {
    const v = out.providerMetadata?.openai?.cachedPromptTokens;
    return typeof v === 'number' ? v : 0;
  })();
  return {
    object: out.object,
    usage: { tokensIn: out.usage.promptTokens, tokensOut: out.usage.completionTokens, tokensCached: cached },
    model,
    operation,
  };
}

// --- Etapa 4: Análise crítica da requisição ---------------------------------
async function analiseCritica(ctx: Proc2PayContext): Promise<ExecResult> {
  const schema = NarrativeSchema.extend({
    ok: z.boolean().describe('true se a requisição está pronta para seguir; false se há lacunas críticas.'),
    gaps: z.array(z.string()).describe('Lacunas/ambiguidades a resolver (especificação, quantidade, prazo, norma).'),
  });
  const r = await runObject(
    `${PERSONA}\nFaça a análise crítica da requisição de compra ANTES de cotar: cheque clareza do escopo, especificações técnicas, quantidades/unidades, prazo, normas aplicáveis e justificativa. Aponte lacunas que atrapalhariam a cotação. Seja construtivo.`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n\nAnalise criticamente e liste o que falta/ajustar antes de seguir para a estratégia de compra.`,
    schema,
    'proc2pay-critica',
  );
  return {
    output: { ok: r.object.ok, gaps: r.object.gaps },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 5: Validação técnica do escopo -----------------------------------
async function validacaoEscopo(ctx: Proc2PayContext): Promise<ExecResult> {
  const schema = NarrativeSchema.extend({
    resumo: z.string().describe('Escopo técnico consolidado, claro para o fornecedor.'),
    criterios: z.array(z.string()).describe('Critérios técnicos de aceitação/avaliação.'),
  });
  const gaps = ctx.analise_critica?.gaps?.length ? `Lacunas apontadas:\n${ctx.analise_critica.gaps.map((g) => `- ${g}`).join('\n')}` : '';
  const r = await runObject(
    `${PERSONA}\nConsolide e valide o escopo técnico da compra: descreva o objeto de forma inequívoca para o fornecedor, normas/especificações, e os critérios técnicos de aceitação. Resolva (ou explicite) as lacunas da análise crítica.`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n${gaps}\n\nProduza o escopo técnico consolidado + critérios de aceitação.`,
    schema,
    'proc2pay-escopo',
  );
  return {
    output: { resumo: r.object.resumo, criterios: r.object.criterios },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 6: Estratégia (Kraljic) ------------------------------------------
async function estrategia(ctx: Proc2PayContext): Promise<ExecResult> {
  const schema = NarrativeSchema.extend({
    quadrante: z.enum(['estrategico', 'alavancagem', 'gargalo', 'nao_critico']),
    postura: z.string().describe('Postura de compra recomendada em 1 frase.'),
  });
  const r = await runObject(
    `${PERSONA}\nClassifique a demanda na Matriz de Kraljic (impacto no resultado × risco de suprimento) e recomende a estratégia de compra do quadrante.`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n\nClassifique o quadrante Kraljic, explique e dê a estratégia de sourcing (postura, nº de fornecedores, alavancas).`,
    schema,
    'proc2pay-estrategia',
  );
  return {
    output: { quadranteKraljic: r.object.quadrante, postura: r.object.postura },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 7: Seleção de fornecedores ---------------------------------------
async function selecaoFornecedores(ctx: Proc2PayContext): Promise<ExecResult> {
  const schema = NarrativeSchema.extend({
    fornecedores: z
      .array(z.object({ nome: z.string(), segmento: z.string().optional(), motivo: z.string() }))
      .describe('Perfis/empresas candidatas a cotar.'),
  });
  const estr = ctx.estrategia ? `Estratégia (Kraljic): ${ctx.estrategia.quadranteKraljic} — ${ctx.estrategia.postura}` : '';
  const r = await runObject(
    `${PERSONA}\nProponha critérios de seleção e uma shortlist de fornecedores/perfis para cotar, coerentes com a estratégia. (A verificação fiscal/CNAE real é integrada numa fase seguinte — aqui você propõe candidatos e critérios.)`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n${estr}\n\nDê critérios de seleção e uma shortlist de candidatos a cotar.`,
    schema,
    'proc2pay-selecao',
  );
  return {
    output: r.object.fornecedores.map((f) => ({ nome: f.nome, homologado: false })),
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 8: RFQ / RFP ------------------------------------------------------
async function rfqRfp(ctx: Proc2PayContext): Promise<ExecResult> {
  const r = await runObject(
    `${PERSONA}\nMonte um documento de RFQ/RFP pronto para enviar aos fornecedores: objeto, escopo/itens, critérios de avaliação, condições comerciais pedidas (prazo, pagamento, validade), e instruções de resposta.`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n\nGere o documento de RFQ/RFP.`,
    NarrativeSchema,
    'proc2pay-rfp',
  );
  return {
    output: { documento: r.object.resumo, geradoEm: new Date().toISOString() },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 9: Recebimento das propostas (MVP manual) ------------------------
function recebimentoPropostas(payload: StagePayload | undefined): ExecResult {
  const texto = (payload?.propostas ?? '').trim();
  return {
    output: [{ texto }],
    artifactMd: texto
      ? `### Propostas recebidas\n\n\`\`\`\n${texto}\n\`\`\``
      : '_Cole as propostas dos fornecedores para equalizar._',
    usage: ZERO_USAGE,
    model: '-',
    operation: 'proc2pay-propostas',
  };
}

// --- Etapa 10: Equalização (reusa o Robô Comprador / TCO) --------------------
async function equalizacao(ctx: Proc2PayContext): Promise<ExecResult> {
  const propostas = Array.isArray(ctx.propostas)
    ? (ctx.propostas as Array<{ texto?: string }>).map((p) => p.texto ?? '').join('\n\n')
    : '';
  if (!propostas.trim()) {
    throw new Error('Sem propostas para equalizar — preencha a etapa "Recebimento das propostas" primeiro.');
  }
  const { result, usage, model } = await analyzeComprador({
    escopo: reqResumo(ctx.requisicao),
    propostas,
    politica: '',
  });
  const md = [
    `## Equalização técnica e comercial`,
    ``,
    `**Recomendação:** ${result.recomendacao_fornecedor}`,
    ``,
    result.justificativa,
    ``,
    `### Ranking (TCO)`,
    ...result.ranking.map(
      (r, i) => `${i + 1}. **${r.fornecedor}** — custo total ≈ R$ ${r.custo_total} · prazo ${r.prazo_entrega} · ${r.condicao_pagamento}`,
    ),
    result.pontos_negociacao.length ? `\n### Pontos de negociação\n${result.pontos_negociacao.map((p) => `- ${p}`).join('\n')}` : '',
  ].join('\n');
  return {
    output: {
      ranking: result.ranking,
      vencedor: { nome: result.recomendacao_fornecedor },
      pontos_negociacao: result.pontos_negociacao,
    },
    artifactMd: md,
    usage,
    model,
    operation: 'proc2pay-equalizacao',
  };
}

// --- Etapa 11: Negociação ----------------------------------------------------
async function negociacao(ctx: Proc2PayContext, payload?: StagePayload): Promise<ExecResult> {
  const vencedor = ctx.equalizacao?.vencedor?.nome ?? '(fornecedor recomendado)';
  const pontos = (ctx.equalizacao as { pontos_negociacao?: string[] } | undefined)?.pontos_negociacao ?? [];
  const schema = NarrativeSchema.extend({
    acordo: z.string().describe('Acordo-alvo / resultado esperado da negociação em 1 frase.'),
  });
  const r = await runObject(
    `${PERSONA}\nMonte a estratégia de negociação com o fornecedor recomendado: objetivos (preço, prazo, pagamento), MAPAN/BATNA, concessões e roteiro. Seja acionável.`,
    `Requisição:\n${reqResumo(ctx.requisicao)}\n\nFornecedor a negociar: ${vencedor}\nPontos de negociação levantados:\n${pontos.map((p) => `- ${p}`).join('\n') || '- (definir)'}\n${payload?.nota ? `\nObservação do comprador: ${payload.nota}` : ''}\n\nGere o plano de negociação.`,
    schema,
    'proc2pay-negociacao',
  );
  return {
    output: { acordo: r.object.acordo },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

// --- Etapa 13: Emissão da PO -------------------------------------------------
async function emissaoPo(ctx: Proc2PayContext): Promise<ExecResult> {
  const fornecedor = ctx.equalizacao?.vencedor?.nome ?? '(fornecedor)';
  const numero = `PO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const schema = NarrativeSchema.extend({
    valorTotal: z.number().describe('Valor total estimado da PO em R$ (0 se indeterminável).'),
  });
  const r = await runObject(
    `${PERSONA}\nGere o Pedido de Compra (PO) formal para o fornecedor escolhido, pronto para enviar por e-mail: número, fornecedor, itens (qtd/unitário/total), valor total, condição de pagamento, prazo de entrega, local de entrega e observações. Use o acordo da negociação.`,
    `Número da PO: ${numero}\nFornecedor: ${fornecedor}\nAcordo da negociação: ${ctx.negociacao?.acordo ?? '(n/d)'}\n\nRequisição:\n${reqResumo(ctx.requisicao)}\n\nGere o documento da PO.`,
    schema,
    'proc2pay-po',
  );
  return {
    output: {
      numero,
      valor: r.object.valorTotal,
      fornecedor: { nome: fornecedor },
      enviadaEm: new Date().toISOString(),
    },
    artifactMd: r.object.markdown,
    usage: r.usage,
    model: r.model,
    operation: r.operation,
  };
}

/**
 * Dispatcher: executa a etapa pelo id. `aprovacao` é tratada fora (route de
 * approve); `requisicao` é feita na criação do processo.
 */
export async function executeStage(
  stage: StageId,
  ctx: Proc2PayContext,
  payload?: StagePayload,
): Promise<ExecResult> {
  switch (stage) {
    case 'analise_critica':
      return analiseCritica(ctx);
    case 'validacao_escopo':
      return validacaoEscopo(ctx);
    case 'estrategia':
      return estrategia(ctx);
    case 'selecao_fornecedores':
      return selecaoFornecedores(ctx);
    case 'rfq_rfp':
      return rfqRfp(ctx);
    case 'recebimento_propostas':
      return recebimentoPropostas(payload);
    case 'equalizacao':
      return equalizacao(ctx);
    case 'negociacao':
      return negociacao(ctx, payload);
    case 'emissao_po':
      return emissaoPo(ctx);
    default:
      throw new Error(`Proc2Pay: etapa "${stage}" não é executável por aqui.`);
  }
}
