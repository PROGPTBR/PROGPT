import { z } from 'zod';
import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import { SAFE_DEFAULT_CLASSIFICATION, type Classification } from './types';

const SYSTEM_PROMPT = `Você classifica perguntas de usuários sobre teorias de procurement (compras corporativas).
Responda SEMPRE com JSON estrito conforme o schema abaixo. Não adicione texto fora do JSON.

Campos:
- theory: string com o nome curto da teoria/framework principal mencionada (ex: "kraljic", "porter", "monczka", "tco", "srm"). null se nenhuma teoria específica for citada ou inferível.
- intent: um de "definition" | "application" | "comparison" | "recommendation" | "smalltalk" | "library_overview".
  - definition: pede o que é, conceito, definição de algum tema/framework
  - application: pede como aplicar, exemplo prático, caso
  - comparison: compara duas ou mais teorias/frameworks
  - recommendation: pede sugestão de abordagem/teoria/leitura
  - smalltalk: saudação, agradecimento, conversa fiada sem conteúdo de procurement
  - library_overview: usuário pergunta sobre a PRÓPRIA BASE/COBERTURA do sistema — "que temas você cobre", "lista de tópicos", "sobre o que você sabe", "what topics do you cover", "what's in your knowledge base". É META — sobre o sistema, não sobre procurement. NÃO confunda com "definition" (que pergunta sobre UM tema específico). Confunda só se o usuário quer descobrir o que está disponível.
- language: "pt" se a pergunta está em português, "en" se em inglês. Default "pt".
- needsRetrieval: false APENAS se intent ∈ ("smalltalk", "library_overview"). Senão true.

Exemplos:
- "O que é Kraljic?" → intent=definition, needsRetrieval=true
- "Quais temas você cobre?" → intent=library_overview, needsRetrieval=false
- "Lista de temas da base" → intent=library_overview, needsRetrieval=false
- "Sobre o que você pode me ensinar?" → intent=library_overview, needsRetrieval=false
- "What's in your knowledge base?" → intent=library_overview, needsRetrieval=false
- "oi, tudo bem?" → intent=smalltalk, needsRetrieval=false`;

const ClassificationSchema = z.object({
  theory: z.string().nullable(),
  intent: z.enum([
    'definition',
    'application',
    'comparison',
    'recommendation',
    'smalltalk',
    'library_overview',
  ]),
  language: z.enum(['pt', 'en']),
  needsRetrieval: z.boolean(),
});

export async function classify(query: string): Promise<Classification> {
  try {
    const ai = getOpenAI();
    const res = await ai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Pergunta:\n${query}` },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 256,
    });
    const text = res.choices[0]?.message?.content ?? '';
    const parsed = ClassificationSchema.parse(JSON.parse(text));
    void recordApiUsage({
      provider: 'openai',
      operation: 'classify',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });
    return parsed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[rag/classifier] falling back to safe default:', message);
    return { ...SAFE_DEFAULT_CLASSIFICATION };
  }
}
