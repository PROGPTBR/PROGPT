// Detecta quando a resposta do chat de procurement é uma recusa por falta de
// fonte na base ("Não tenho fonte sobre isso...") — SEM 'use client' de
// propósito, é função pura chamada direto no render de Message.tsx (mesmo
// espírito de detectAssistantToolCTA em assistant-tool-cta-shared.ts).
//
// A frase exata é gerada pelo LLM (instrução em lib/rag/prompt-builder.ts:
// "diga explicitamente, em uma frase, que não tem fonte sobre isso na sua
// base"), não é um template fixo — por isso o regex cobre as variações mais
// prováveis em vez de um match exato.
const REFUSAL_PATTERNS = [
  /não\s+ten(?:ho|ho)\s+fonte/i,
  /sem\s+fonte\s+(?:sobre|para)\s+isso/i,
  /não\s+tenho\s+(?:essa\s+)?informaç[ãa]o\s+na\s+(?:minha\s+)?base/i,
];

export function looksLikeRefusal(text: string): boolean {
  return REFUSAL_PATTERNS.some((re) => re.test(text));
}
