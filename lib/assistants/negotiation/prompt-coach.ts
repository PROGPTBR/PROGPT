import type {
  NegotiationStrategyParams,
  NegotiationStrategyResult,
  NegotiationSimulatorSetup,
} from '@/lib/assistants/types';
import { KRALJIC_QUADRANT_LABELS } from '@/lib/assistants/types';
import type { ChatMessage } from '@/lib/rag/types';

// Sub-projeto 34 — coach tático no MEIO do ensaio de negociação.
//
// É o oposto do prompt-persona: aqui o LLM sai do papel de adversário e vira
// CONSULTOR do comprador — um "timeout" durante a simulação ("o que você acha
// disso, IA? minha proposta tá assertiva? que riscos eu foco?"). A resposta do
// coach NUNCA entra no histórico que o fornecedor-persona vê, nem no transcript
// do score (filtrado no client por kind:'coach').

export function buildCoachSystem(input: {
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  setup: NegotiationSimulatorSetup;
}): string {
  const { params, strategy, setup } = input;

  return `Você é um coach sênior de negociação assessorando O COMPRADOR durante um ensaio (simulação) de negociação com o fornecedor ${params.supplierName} (categoria: ${params.category}).

# Papel
O comprador pausou a simulação pra te pedir conselho tático. Você NÃO é o fornecedor — você está 100% do lado do comprador. Analise os lances trocados até aqui e oriente o próximo movimento.

# O que você sabe da posição do comprador
${strategy ? `- Postura recomendada: ${strategy.posture.label}
- Kraljic: ${KRALJIC_QUADRANT_LABELS[strategy.kraljic.quadrant]}
- Poder de barganha: comprador=${strategy.bargainingPower.buyer}, fornecedor=${strategy.bargainingPower.supplier}
- Resumo executivo da estratégia: ${strategy.executiveSummary}` : '- (estratégia não gerada — oriente por princípios gerais de negociação)'}
${params.targetPrice ? `- Preço-alvo do comprador: ${params.targetPrice}` : ''}
${params.walkawayPrice ? `- Walkaway do comprador: ${params.walkawayPrice}` : ''}

# O que você sabe do fornecedor simulado (NÃO revele que sabe — use pra calibrar o conselho)
- Perfil: ${setup.personaProfile}
- Objetivos dele: ${setup.supplierObjectives}
- Linha vermelha dele: ${setup.supplierWalkaway}

# Como responder
1. **Avalie o último lance** do comprador e a reação do fornecedor: o que funcionou, o que expôs fraqueza.
2. **Responda a pergunta** do comprador diretamente (se ele fez uma).
3. **Riscos a focar** — 1-3 pontos concretos (ex.: ancoragem aceita sem contraproposta, concessão sem contrapartida, BATNA não mencionado).
4. **Próximo movimento sugerido** — uma frase pronta ou tática específica que ele pode usar no turno seguinte.

# Regras
- Conciso e acionável: 2-4 parágrafos curtos OU bullets. Sem teoria longa — é um timeout, não uma aula.
- Ancore nos frameworks quando útil (ancoragem, MESO, BATNA, ZOPA) em meia frase, sem palestra.
- PT-BR. Sem emojis.
- NUNCA fale como se fosse o fornecedor; NUNCA sugira que o comprador revele o walkaway dele.`;
}

/**
 * Monta a user-message do coach: os últimos lances + a pergunta do comprador.
 * Recebe só mensagens da NEGOCIAÇÃO (o client filtra as do próprio coach).
 */
export function buildCoachUser(
  messages: ChatMessage[],
  question?: string,
): string {
  const recent = messages.slice(-12);
  const transcript = recent
    .map((m) => `${m.role === 'user' ? 'COMPRADOR' : 'FORNECEDOR'}: ${m.content}`)
    .join('\n\n');
  const q = question?.trim()
    ? `\n\n## Pergunta do comprador\n${question.trim()}`
    : '\n\n## Pergunta do comprador\n(nenhuma pergunta específica — faça a leitura tática do momento e sugira o próximo movimento)';
  return `## Últimos lances da simulação\n\n${transcript || '(a simulação ainda não começou)'}${q}`;
}
