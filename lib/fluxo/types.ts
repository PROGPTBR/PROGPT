import { z } from 'zod';

import type { FluxoStageId } from './stages';

// Fluxo Automatizado de Compras — tipos.
//
// Toda etapa devolve o MESMO envelope, de propósito: a tela é uma só (o card
// da etapa, igual ao infográfico) e o comprador vê sempre as mesmas seções —
// o que a IA fez, o que ele precisa conferir, e qual é a saída se ele seguir.

// Todos os campos são OBRIGATÓRIOS de propósito: o tier de geração em produção
// (gpt-5.4-mini) é tratado como modelo de raciocínio pelo @ai-sdk/openai, que
// liga o modo estrito do structured output — e ele recusa o esquema inteiro se
// algum campo for opcional (.default/.optional). Foi isso que fez TODA etapa do
// Fluxo falhar em produção até 2026-10-07. Lista vazia é resposta válida.
export const FluxoStageOutputSchema = z.object({
  resumo: z
    .string()
    .describe('2 a 4 frases sobre o que foi executado nesta etapa.'),

  campos: z
    .array(z.object({ rotulo: z.string(), valor: z.string() }))
    .describe('Dados estruturados que a etapa produziu (rótulo → valor).'),

  itens: z
    .array(z.object({ titulo: z.string(), detalhe: z.string() }))
    .describe(
      'Lista da etapa: itens da requisição, fornecedores da shortlist, propostas comparadas, linhas do pedido.',
    ),

  pontos_de_revisao: z
    .array(z.string())
    .describe('O que o comprador precisa conferir antes de decidir.'),

  alertas: z
    .array(z.string())
    .describe('Riscos, divergências e desvios de política. Vazio se não houver.'),

  saida: z
    .string()
    .describe('Uma frase declarando o resultado da etapa, se for aprovada.'),
});

export type FluxoStageOutput = z.infer<typeof FluxoStageOutputSchema>;

/** Decisão do comprador sobre uma execução de etapa. */
export type FluxoDecisao = 'pendente' | 'siga' | 'ajustar';

export type FluxoStatus = 'em_andamento' | 'concluido' | 'cancelado';

/** Acumulador de handoff: a saída aprovada de cada etapa vira entrada da
 *  seguinte. Só entra aqui o que recebeu SIGA. */
export type FluxoContexto = Partial<Record<FluxoStageId, FluxoStageOutput>>;

export type FluxoProcesso = {
  id: string;
  user_id: string;
  titulo: string;
  requisicao: string;
  etapa_atual: FluxoStageId;
  status: FluxoStatus;
  contexto: FluxoContexto;
  created_at: string;
  updated_at: string;
};

export type FluxoEtapa = {
  id: string;
  processo_id: string;
  user_id: string;
  etapa: FluxoStageId;
  /** Nº da rodada: AJUSTAR gera uma execução nova da MESMA etapa. */
  rodada: number;
  saida: FluxoStageOutput;
  decisao: FluxoDecisao;
  observacao: string | null;
  decidida_em: string | null;
  created_at: string;
};
