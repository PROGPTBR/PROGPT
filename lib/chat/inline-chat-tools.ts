// Tools automáticas do chat principal (procurement) — piloto "agentes de
// conversa acionados sem trocar de tela". O modelo decide sozinho, guiado
// pelas instruções em lib/rag/prompt-builder.ts, quando chamar cada uma:
//
// - `responder_fora_do_escopo`: marcador sem trabalho real — só dá um sinal
//   estruturado e confiável de "esta resposta saiu do grounding" (mais
//   robusto que tentar adivinhar pelo texto da resposta). Reusa o MESMO
//   badge "Modo Pessoal" que o Assistente Pessoal já usa desde ontem.
// - `web_search`: reaproveitada de lib/chat/web-search-tool.ts, disponível
//   junto com a de cima pra perguntas fora do escopo que são tempo-sensíveis.
// - `preco_referencia`: roda o MESMO pipeline de /assistants/pesquisa_precos
//   (lib/govdata/precos.ts) inline, sem abrir a tela dedicada.
// - `indicadores_economicos`: Selic/IPCA/câmbio ao vivo do BACEN
//   (lib/govdata/indicadores.ts) — zero input, resposta imediata.
// - `diagnostico_aquisicao_rapido`: classificação SOURCE/CONTRACT/BUY +
//   KPIs (lib/assistants/diagnostico-aquisicao.ts) — 100% determinístico e
//   síncrono, sem I/O nenhum.
// - `homologacao_rapida`: situação cadastral + score de risco de um CNPJ
//   (lib/fiscal/client.ts) — só a checagem rápida; o relatório completo
//   (certidões, sanções, due diligence, .docx) continua exigindo abrir
//   /assistants/homologacao.
//
// Todas seguem o mesmo contrato: nunca lançam de dentro de execute() (isso
// abortaria o stream inteiro do chat) e devolvem uma string em PT-BR que
// instrui o modelo externo (o mesmo streamText do chat) a basear a resposta
// nesses dados — a tool não gera texto pro usuário sozinha.
//
// classifier.ts/runRag NÃO são tocados — as tools operam ortogonalmente à
// classificação/retrieval normal, dentro do mesmo streamText.

import { tool } from 'ai';
import { z } from 'zod';
import { buscarCatmat, precoReferencia } from '@/lib/govdata/precos';
import { indicadoresAtuais, indicadoresMarkdown } from '@/lib/govdata/indicadores';
import { classifyAquisicao } from '@/lib/assistants/diagnostico-aquisicao';
import { DIAGNOSTICO_NATUREZA } from '@/lib/assistants/types';
import { isFiscalEnabled, consultarCnpj, riskScoreSupplier } from '@/lib/fiscal/client';

export function isOffTopicFallbackEnabled(): boolean {
  return process.env.CHAT_OFF_TOPIC_FALLBACK !== 'false';
}

export function isChatToolWebSearchEnabled(): boolean {
  return (
    isOffTopicFallbackEnabled() &&
    process.env.CHAT_TOOL_WEBSEARCH !== 'false' &&
    !!process.env.OPENAI_API_KEY
  );
}

export function isPrecoReferenciaToolEnabled(): boolean {
  return process.env.CHAT_PRECO_REFERENCIA_TOOL !== 'false';
}

export function isIndicadoresToolEnabled(): boolean {
  return process.env.CHAT_INDICADORES_TOOL !== 'false';
}

export function isDiagnosticoAquisicaoToolEnabled(): boolean {
  return process.env.CHAT_DIAGNOSTICO_AQUISICAO_TOOL !== 'false';
}

export function isHomologacaoQuickToolEnabled(): boolean {
  return process.env.CHAT_HOMOLOGACAO_TOOL !== 'false' && isFiscalEnabled();
}

// Sem trabalho real — só um sinal estruturado. `parameters` vazio: o modelo
// só precisa CHAMAR, não informar nada.
export function createOffBaseMarkerTool(usedRef: { current: boolean }) {
  return tool({
    description:
      'Chame esta ferramenta ANTES de responder quando a pergunta for CLARAMENTE sobre um assunto sem nenhuma relação com compras/suprimentos (esporte, notícia, curiosidade geral, vida pessoal, etc.) — NÃO para uma dúvida de procurement que a base simplesmente não cobre (essa continua seguindo a regra normal de "não tenho fonte"). Sem parâmetros.',
    parameters: z.object({}),
    execute: async () => {
      usedRef.current = true;
      return 'Ok — pode responder normalmente usando conhecimento geral (e a tool web_search se a pergunta for sobre algo atual).';
    },
  });
}

// Timeout "soft": o pipeline de baixo (buscarCatmat + precoReferencia) não
// aceita AbortSignal, então não dá pra cancelar de verdade — a chamada
// abandonada segue rodando em segundo plano (custo perdido, aceito como
// trade-off) mas o turno do chat não fica preso esperando indefinidamente.
const PRECO_TOOL_TIMEOUT_MS = 30_000;
function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(onTimeout()), ms))]);
}

export function createPrecoReferenciaTool(ctx: { usedRef: { current: boolean } }) {
  return tool({
    description:
      'Busca o preço de referência de um item específico nas compras públicas (CATMAT/Painel de Preços) — mediana, faixa e número de amostras. Use quando o usuário perguntar quanto custa, qual o preço de mercado/referência, ou quanto deveria pagar por um item ou material específico.',
    parameters: z.object({
      descricao: z
        .string()
        .describe('Descrição do item em linguagem natural (ex.: "papel A4 75g", "notebook i5 8GB").'),
    }),
    execute: async ({ descricao }: { descricao: string }) => {
      ctx.usedRef.current = true;
      return withTimeout(
        (async () => {
          // buscarCatmat/precoReferencia já são fail-soft por contrato (lib/
          // govdata/precos.ts) — o try/catch aqui é defesa em profundidade,
          // igual ao web_search: NUNCA lançar de dentro de execute(), senão
          // aborta o stream inteiro do chat.
          try {
            const match = await buscarCatmat(descricao);
            if (!match) {
              return 'Não encontrei esse item no catálogo de compras públicas (CATMAT). Responda com base no seu conhecimento geral, deixando claro que não há preço de referência oficial disponível pra esse item específico.';
            }
            const ref = await precoReferencia(match.codigoItem);
            if (!ref.stats) {
              return `Encontrei o item "${match.descricaoItem}" no catálogo (código CATMAT ${match.codigoItem}), mas não há preços praticados registrados pra ele nas compras públicas. Responda com base no seu conhecimento geral, avisando que não há amostra oficial pra esse item.`;
            }
            return [
              `Item identificado no CATMAT: "${match.descricaoItem}" (código ${match.codigoItem}).`,
              `Preço de referência de compras públicas, ${ref.stats.n} amostras válidas (de ${ref.totalAmostras} totais):`,
              `- Mediana: R$ ${ref.stats.mediana}`,
              `- Faixa (P25-P75): R$ ${ref.stats.p25} a R$ ${ref.stats.p75}`,
              `- Mínimo/Máximo observados: R$ ${ref.stats.min} a R$ ${ref.stats.max}`,
              'Baseie sua resposta nesses números reais. Deixe claro que é uma referência de preços praticados em compras públicas (não é garantia de preço no mercado privado, que pode variar).',
            ].join('\n');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `A busca de preço de referência falhou (${msg}). Responda com base no seu conhecimento geral, avisando que não conseguiu confirmar um preço de referência oficial agora.`;
          }
        })(),
        PRECO_TOOL_TIMEOUT_MS,
        () =>
          'A busca de preço de referência demorou demais e foi cancelada. Responda com base no seu conhecimento geral, avisando que não conseguiu confirmar um preço de referência oficial agora.',
      );
    },
  });
}

const INDICADORES_TOOL_TIMEOUT_MS = 20_000;

export function createIndicadoresTool(ctx: { usedRef: { current: boolean } }) {
  return tool({
    description:
      'Consulta ao vivo a Selic (meta), o IPCA acumulado em 12 meses e o câmbio (dólar) direto do Banco Central. Use quando o usuário perguntar pela Selic, inflação/IPCA, ou cotação do dólar hoje/atual/agora.',
    parameters: z.object({}),
    execute: async () => {
      ctx.usedRef.current = true;
      return withTimeout(
        (async () => {
          try {
            const ind = await indicadoresAtuais();
            const md = indicadoresMarkdown(ind);
            if (!md) {
              return 'Não consegui consultar os indicadores econômicos agora (fonte do Banco Central indisponível). Avise o usuário disso, sem inventar números.';
            }
            return `${md}\n\nBaseie sua resposta nesses números reais e nas datas indicadas. Se o usuário quiser mais indicadores (CDI, IGP-M, euro) ou histórico, sugira o painel completo em /assistants/indicadores.`;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `A consulta aos indicadores econômicos falhou (${msg}). Avise o usuário que não conseguiu confirmar os números agora, sem inventar valores.`;
          }
        })(),
        INDICADORES_TOOL_TIMEOUT_MS,
        () => 'A consulta aos indicadores econômicos demorou demais e foi cancelada. Avise o usuário que não conseguiu confirmar os números agora.',
      );
    },
  });
}

export function createDiagnosticoAquisicaoTool(ctx: { usedRef: { current: boolean } }) {
  return tool({
    description:
      'Classifica uma decisão de compra em estratégia de sourcing SOURCE, CONTRACT ou BUY, e lista os KPIs certos pra acompanhar — a partir da natureza da compra (CAPEX ou OPEX) e de 3 fatores: criticidade, complexidade do mercado fornecedor e impacto operacional. Use quando o usuário descrever uma compra/investimento específico e pedir uma recomendação de estratégia de sourcing ou quais KPIs acompanhar. Se a classificação CAPEX/OPEX ou algum dos 3 fatores não estiver claro no que o usuário escreveu, pergunte antes de chamar esta ferramenta — não adivinhe.',
    parameters: z.object({
      descricaoCompra: z.string().min(2).max(300).describe('O que está sendo comprado, em poucas palavras.'),
      natureza: z
        .enum(DIAGNOSTICO_NATUREZA)
        .describe('Se a compra é de produto, serviço, ou os dois.'),
      classificacao: z
        .enum(['CAPEX', 'OPEX'])
        .describe('CAPEX = investimento/ativo; OPEX = despesa operacional recorrente.'),
      criticidade: z
        .enum(['baixa', 'media', 'alta'])
        .describe('Quão crítica essa compra é pra operação continuar funcionando.'),
      complexidadeMercado: z
        .enum(['baixa', 'media', 'alta'])
        .describe('Quão complexo/concentrado é o mercado de fornecedores pra esse item.'),
      impactoOperacional: z
        .enum(['baixo', 'medio', 'alto'])
        .describe('Impacto no resultado/operação se a compra der errado.'),
    }),
    execute: async (params) => {
      ctx.usedRef.current = true;
      // classifyAquisicao é pura e síncrona (sem I/O) — não precisa de
      // timeout nem, a rigor, de try/catch, mas mantemos por defesa em
      // profundidade (mesmo contrato das outras tools: nunca lançar).
      // Só criticidade/complexidade/impacto/classificação entram na conta;
      // descricaoCompra/natureza servem pra tornar a extração do modelo mais
      // completa e pra puxar o mesmo vocabulário do assistente completo.
      try {
        const result = classifyAquisicao({ ...params, categoria: '', notes: '' });
        return [
          `Classificação informada: ${params.classificacao}.`,
          `Criticidade ${params.criticidade} (${result.criticidadeScore}/3), complexidade de mercado ${params.complexidadeMercado} (${result.complexidadeScore}/3), impacto operacional ${params.impactoOperacional} (${result.impactoScore}/3) — score total ${result.totalScore}/9.`,
          `Estratégia de sourcing recomendada: ${result.leaning}.`,
          `KPIs recomendados pra essa classificação: ${result.kpis.join(', ')}.`,
          'Baseie sua resposta nesses números — explique o racional (por que essa estratégia faz sentido pra essa combinação) usando seu conhecimento de procurement. Se o usuário quiser o relatório executivo formal, sugira abrir o assistente de Diagnóstico de Aquisição em /assistants/diagnostico_aquisicao.',
        ].join('\n');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `A classificação falhou (${msg}). Responda com base no seu conhecimento geral de procurement, sem inventar uma recomendação de estratégia.`;
      }
    },
  });
}

const HOMOLOGACAO_TOOL_TIMEOUT_MS = 20_000;

export function createHomologacaoQuickTool(ctx: { usedRef: { current: boolean } }) {
  return tool({
    description:
      'Consulta rapidamente a situação cadastral e o score de risco de um fornecedor pelo CNPJ (dados fiscais reais). Use quando o usuário pedir uma checagem rápida de um CNPJ/fornecedor no chat. Para o relatório completo (certidões, sanções, due diligence, QSA, capital social, .docx), esta ferramenta não é o caminho — sugira abrir o assistente de Homologação de Fornecedor.',
    parameters: z.object({
      cnpj: z.string().describe('CNPJ do fornecedor, com ou sem formatação (só os dígitos são usados).'),
    }),
    execute: async ({ cnpj }) => {
      ctx.usedRef.current = true;
      return withTimeout(
        (async () => {
          try {
            const [cnpjR, riskR] = await Promise.allSettled([
              consultarCnpj(cnpj),
              riskScoreSupplier(cnpj),
            ]);
            const data = cnpjR.status === 'fulfilled' ? cnpjR.value : null;
            const risk = riskR.status === 'fulfilled' ? riskR.value : null;
            if (!data && !risk) {
              return 'A consulta fiscal desse CNPJ falhou ou não retornou dados. Avise o usuário disso, sem inventar a situação cadastral.';
            }
            const lines: string[] = [];
            if (data) {
              lines.push(
                `Razão social: ${data.razao_social}${data.nome_fantasia ? ` (${data.nome_fantasia})` : ''}.`,
              );
              lines.push(`Situação cadastral: ${data.situacao_cadastral}.`);
              if (data.porte) lines.push(`Porte: ${data.porte}.`);
            }
            if (risk) {
              lines.push(
                `Score de risco: ${risk.score}/100 (${risk.risco}) — recomendação: ${risk.recomendacao}.`,
              );
              if (risk.fatores.length > 0) lines.push(`Fatores considerados: ${risk.fatores.join('; ')}.`);
            }
            lines.push(
              'Baseie sua resposta nesses dados reais. Se a situação cadastral não for "ATIVA", isso é um alerta grave — destaque isso claramente. Pra checagem completa (certidões, sanções, due diligence, QSA, capital social, relatório .docx), sugira abrir o assistente de Homologação de Fornecedor em /assistants/homologacao.',
            );
            return lines.join('\n');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return `A consulta fiscal falhou (${msg}). Avise o usuário disso, sem inventar dados do CNPJ.`;
          }
        })(),
        HOMOLOGACAO_TOOL_TIMEOUT_MS,
        () => 'A consulta fiscal demorou demais e foi cancelada. Avise o usuário que não conseguiu confirmar os dados agora.',
      );
    },
  });
}
