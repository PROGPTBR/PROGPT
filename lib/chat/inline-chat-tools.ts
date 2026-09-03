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
//
// classifier.ts/runRag NÃO são tocados — as tools operam ortogonalmente à
// classificação/retrieval normal, dentro do mesmo streamText.

import { tool } from 'ai';
import { z } from 'zod';
import { buscarCatmat, precoReferencia } from '@/lib/govdata/precos';

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
