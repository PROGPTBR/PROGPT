import { FLUXO_STAGES, type FluxoStage } from './stages';
import type { FluxoContexto } from './types';

// Montagem do prompt de uma etapa. PURA e sem I/O de propósito — é o que os
// testes travam (a etapa certa, o contexto certo, e o pedido de ajuste
// chegando ao modelo).

export const FLUXO_SYSTEM_PROMPT = `Você é um comprador sênior brasileiro executando uma etapa de um processo de compras automatizado.

REGRA CENTRAL DO PROCESSO: você EXECUTA a etapa; quem DECIDE é o comprador. Nunca afirme que algo foi aprovado, emitido, enviado ou recebido — você prepara, ele aprova.

Como responder:
- Trabalhe SOMENTE com o que está no contexto. Quando um dado essencial faltar, escreva "não informado" e registre a falta em pontos_de_revisao — nunca invente fornecedor, preço, prazo, CNPJ ou imposto.
- resumo: 2 a 4 frases, direto, sem enrolação.
- campos: os dados estruturados da etapa (rótulo curto → valor).
- itens: a lista da etapa (itens da requisição, fornecedores, propostas, linhas do pedido). Vazio quando não se aplica.
- pontos_de_revisao: o que o comprador precisa conferir ANTES de decidir, na ordem de importância.
- alertas: riscos concretos, divergências e desvios de política. Vazio se não houver — não encha linguiça.
- saida: uma frase declarando o resultado da etapa caso ele aprove.

Português do Brasil. Sem markdown nos campos, sem títulos, sem bullets dentro das strings.`;

function blocoContexto(contexto: FluxoContexto): string {
  const partes: string[] = [];

  for (const stage of FLUXO_STAGES) {
    const anterior = contexto[stage.id];
    if (!anterior) continue;

    const campos = anterior.campos
      .map((c) => `${c.rotulo}: ${c.valor}`)
      .join('; ');
    const itens = anterior.itens
      .map((i) => `- ${i.titulo}: ${i.detalhe}`)
      .join('\n');

    partes.push(
      [
        `### Etapa ${stage.num} — ${stage.label} (aprovada)`,
        anterior.resumo,
        campos ? `Dados: ${campos}` : '',
        itens,
        anterior.alertas.length ? `Alertas: ${anterior.alertas.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  return partes.join('\n\n');
}

export function buildStagePrompt(args: {
  stage: FluxoStage;
  requisicao: string;
  contexto: FluxoContexto;
  /** Texto do AJUSTAR: a correção que o comprador pediu nesta etapa. */
  ajuste?: string | null;
  /** Dados extras coletados fora do LLM (ex.: situação fiscal real). */
  enriquecimento?: string | null;
}): string {
  const { stage, requisicao, contexto, ajuste, enriquecimento } = args;

  const anteriores = blocoContexto(contexto);

  return [
    `## Etapa ${stage.num} de ${FLUXO_STAGES.length}: ${stage.label}`,
    `Entrada esperada: ${stage.entrada}`,
    `O que você deve fazer: ${stage.automacaoDetalhe}`,
    `O comprador vai conferir: ${stage.revisaoDetalhe}`,
    `Saída esperada desta etapa: ${stage.saida}`,
    '',
    '## Requisição original',
    requisicao.trim() || '(não informada)',
    anteriores ? '\n## Etapas já aprovadas neste processo\n' + anteriores : '',
    enriquecimento
      ? '\n## Dados consultados automaticamente (fonte oficial, use como verdade)\n' +
        enriquecimento
      : '',
    ajuste
      ? '\n## AJUSTE PEDIDO PELO COMPRADOR\nA execução anterior desta MESMA etapa foi recusada. Refaça a etapa atendendo exatamente a esta correção:\n' +
        ajuste.trim()
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
