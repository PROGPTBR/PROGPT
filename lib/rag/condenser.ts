import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';
import type { ChatMessage } from './types';

const SYSTEM_PROMPT = `Reescreva a última pergunta do usuário como uma pergunta autônoma em português, incorporando o contexto necessário das mensagens anteriores. Responda APENAS com a pergunta reescrita, sem explicações, sem aspas, sem prefixos.`;

function lastUserContent(messages: ChatMessage[]): string {
  const last = messages[messages.length - 1];
  return (last?.content ?? '').trim();
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function formatHistory(messages: ChatMessage[]): string {
  const lines: string[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const m = messages[i]!;
    const who = m.role === 'user' ? 'Usuário' : 'Assistente';
    lines.push(`${who}: ${m.content}`);
  }
  lines.push(`Última pergunta: ${messages[messages.length - 1]!.content}`);
  return lines.join('\n');
}

export async function condenseQuery(messages: ChatMessage[]): Promise<string> {
  if (messages.length <= 1) {
    return lastUserContent(messages);
  }
  try {
    const ai = getOpenAI();
    const res = await ai.chat.completions.create({
      model: getOpenAIModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: formatHistory(messages) },
      ],
      // Reescrita de query é determinística — default 1.0 podia gerar uma
      // pergunta autônoma ruim que não recupera nada (mesma classe de bug do
      // classificador, no caminho multi-turno).
      temperature: 0,
      max_completion_tokens: 256,
    });
    const text = (res.choices[0]?.message?.content ?? '').trim();
    void recordApiUsage({
      provider: 'openai',
      operation: 'condense',
      model: getOpenAIModel(),
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
      tokensCached: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    });
    if (!text) return lastUserContent(messages);
    return stripQuotes(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[rag/condenser] falling back to last user message:', message);
    return lastUserContent(messages);
  }
}
