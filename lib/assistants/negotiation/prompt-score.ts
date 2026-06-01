import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import {
  NegotiationScoreSchema,
  type NegotiationScore,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
  type NegotiationSimulatorSetup,
  type NegotiationTranscriptTurn,
} from '@/lib/assistants/types';

// Análise pós-sessão. Recebe o transcript inteiro + a estratégia que
// orientava o user + setup do fornecedor; retorna NegotiationScore JSON
// com 4 dimensões pontuadas (0-100) + bullets de strengths/weaknesses/
// recommendations.
//
// Critérios de pontuação (calibrados no prompt pra reduzir variância):
//   - Anchoring: qualidade da primeira oferta + suporte de justificativa
//   - Concessions: trade-offs pareados vs concessões grátis (MESO)
//   - BATNA: se manteve walkaway, ameaçou crível de sair, usou alternativas
//   - Closing: condução pra fechamento + termos resumidos no final

const TIMEOUT_MS = 60_000;

const SCORE_SYSTEM = `Você é um instrutor sênior de negociação corporativa avaliando uma sessão de treino de um comprador.

Sua tarefa: analisar o TRANSCRIPT INTEIRO de uma negociação simulada (user é o comprador, assistant é o fornecedor) e retornar JSON estrito com:
- overall: 0-100 (média ponderada das 4 dimensões, com leve viés pra "closing" e "BATNA")
- dimensions: { anchoring, concessions, batna, closing } cada um 0-100
- strengths: 2-5 bullets curtos do que o COMPRADOR fez bem
- weaknesses: 2-5 bullets curtos do que o COMPRADOR fez mal
- recommendations: 2-5 bullets de orientação acionável pra próxima negociação

Calibração de scoring (0-100):
- ANCHORING: 90+ se o comprador ancorou cedo, agressivo mas com justificativa técnica/dados; 50-70 se ancorou tarde ou genérico; <50 se aceitou a âncora do fornecedor sem responder.
- CONCESSIONS: 90+ se cedeu sempre em troca de algo (volume, prazo, escopo); 50-70 se cedeu equilibrado mas com algumas concessões grátis; <50 se cedeu várias vezes sem contrapartida (concession dumping).
- BATNA: 90+ se mencionou alternativa crível, manteve walkaway, ameaçou sair sem blefar; 50-70 se mencionou mas não usou bem; <50 se nunca usou alternativa nem walkaway.
- CLOSING: 90+ se fechou claramente com termos resumidos (preço, prazo, escopo, próximos passos); 50-70 se fechou mas com termos vagos; <50 se não chegou em acordo ou ficou em loop.

Tom dos bullets: técnico, direto, sem chavões. Cite exemplos do transcript quando possível ("Você cedeu 8% sem pedir aumento de prazo no turno 4"). PT-BR.

JSON STRICT — sem texto fora.`;

function transcriptToText(transcript: NegotiationTranscriptTurn[]): string {
  return transcript
    .map((t, i) => `[${i + 1}] ${t.role.toUpperCase()}: ${t.content}`)
    .join('\n\n');
}

export async function generateScore(input: {
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  setup: NegotiationSimulatorSetup;
  transcript: NegotiationTranscriptTurn[];
}): Promise<NegotiationScore> {
  const ai = getOpenAI();
  const model = getOpenAIModel('generation');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const transcriptText = transcriptToText(input.transcript);
    const targetPrice = input.params.targetPrice || '(não definido)';
    const walkawayPrice = input.params.walkawayPrice || '(não definido)';
    const userMsg = `# Contexto
Fornecedor: ${input.params.supplierName}
Categoria: ${input.params.category}
Meta do comprador: ${targetPrice}
Limite de abandono do comprador: ${walkawayPrice}
Perfil do fornecedor configurado: ${input.setup.personaProfile}

# Transcript (${input.transcript.length} turnos)
${transcriptText}

# Tarefa
Avalie o desempenho do COMPRADOR (role 'user') e retorne o JSON.`;

    const completion = await ai.chat.completions.parse(
      {
        model,
        messages: [
          { role: 'system', content: SCORE_SYSTEM },
          { role: 'user', content: userMsg },
        ],
        response_format: zodResponseFormat(
          NegotiationScoreSchema,
          'negotiation_score',
        ),
        max_completion_tokens: 4_000,
      },
      { signal: controller.signal },
    );
    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      const refusal = completion.choices[0]?.message?.refusal;
      throw new Error(
        `Score returned no parsed content${refusal ? `; refusal: ${refusal}` : ''}`,
      );
    }
    void recordApiUsage({
      provider: 'openai',
      operation: 'assistant-negotiation-score',
      model,
      tokensIn: completion.usage?.prompt_tokens ?? 0,
      tokensOut: completion.usage?.completion_tokens ?? 0,
      tokensCached: completion.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      metadata: {
        turn_count: input.transcript.length,
        overall: parsed.overall,
      },
    });
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}
