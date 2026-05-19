import { getOpenAI, getOpenAIModel } from '@/lib/llm/openai';
import { recordApiUsage } from '@/lib/observability/api-usage';

// Generates a short PT-BR title that summarizes a chat conversation.
// Called once per session, after the first assistant response — the
// classic auto-derived "first user message truncated" title is replaced
// by a human-readable summary so /chat sidebar entries are scannable.
//
// Output: 3-7 words, Title Case, sem aspas, sem ponto final, no máximo
// 60 chars. Falls back to the truncated user-message if the LLM call
// fails — never throws.

const MAX_TITLE_CHARS = 60;
const TIMEOUT_MS = 8_000;

const SYSTEM_PROMPT = `Você nomeia conversas com um especialista em compras (procurement).

Tarefa: gerar um TÍTULO curto que resuma a conversa.

Regras:
- 3 a 7 palavras
- Em português (PT-BR)
- Title Case (Cada Palavra com Inicial Maiúscula)
- SEM aspas, SEM ponto final, SEM emojis
- Específico: capture o tema principal (framework, categoria, situação)
- Máximo 60 caracteres

Exemplos:
- "Aplicar Kraljic em Embalagens"
- "Diferença Entre RFP e RFQ"
- "Estratégia de Sourcing para TI"
- "Negociação com Fornecedor Único"

Responda APENAS com o título, sem explicação.`;

export type TitleSummaryInput = {
  userMessage: string;
  assistantSnippet: string;
};

export async function summarizeChatTitle({
  userMessage,
  assistantSnippet,
}: TitleSummaryInput): Promise<string | null> {
  const fallback = truncate(userMessage);
  const userBlock = [
    'PERGUNTA:',
    userMessage.slice(0, 400),
    '',
    'RESPOSTA (trecho):',
    assistantSnippet.slice(0, 600),
  ].join('\n');

  const ai = getOpenAI();
  const model = getOpenAIModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await ai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userBlock },
        ],
        temperature: 0.3,
        max_completion_tokens: 30,
      },
      { signal: controller.signal },
    );

    const raw = res.choices[0]?.message?.content?.trim() ?? '';
    const cleaned = clean(raw);

    void recordApiUsage({
      provider: 'openai',
      operation: 'chat-title-summarize',
      model,
      tokensIn: res.usage?.prompt_tokens ?? 0,
      tokensOut: res.usage?.completion_tokens ?? 0,
    });

    if (cleaned.length === 0) return fallback;
    return truncate(cleaned);
  } catch (err) {
    console.warn('[chat-title] summarize failed:', err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

function clean(raw: string): string {
  let s = raw.trim();
  // Loop trim — handles "Title". → Title". → Title" → Title (and any
  // permutation of wrapping quotes + trailing period the model produces).
  for (let i = 0; i < 4; i++) {
    const before = s;
    s = s.replace(/^["'`]+|["'`]+$/g, ''); // strip wrapping quotes
    s = s.replace(/\.+$/, ''); // strip trailing periods
    if (s === before) break;
  }
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_TITLE_CHARS) return t;
  return t.slice(0, MAX_TITLE_CHARS) + '…';
}
