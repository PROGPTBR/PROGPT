// O que vai para o Langfuse (2026-10-08, pedido de auditoria de cliente):
// só dado técnico, nunca o conteúdo da conversa. Mensagens, perguntas,
// respostas, prompts e texto de anexo viram "[texto omitido: N caracteres]".
//
// Duas regras, a mais restritiva vence:
// 1. chave de conteúdo (messages, content, query, prompt...) é sempre omitida,
//    seja qual for o tipo do valor;
// 2. fora dessas chaves, só passa texto curto sem espaço (rótulos técnicos
//    como "definition", "pt", "gpt-5.4-mini", UUIDs). Frase de qualquer
//    tamanho é omitida, mesmo que alguém crie um span novo com chave nova.

const CHAVES_DE_CONTEUDO = new Set(
  [
    'messages', 'message', 'content', 'text', 'texto', 'query', 'question', 'pergunta',
    'answer', 'resposta', 'prompt', 'system', 'user', 'input', 'output', 'comment',
    'parsedtext', 'attachment', 'anexo', 'transcript', 'transcricao', 'chunks', 'snippet',
    'title', 'titulo', 'followups', 'notes', 'notas', 'escopo', 'propostas',
  ].map((c) => c.toLowerCase()),
);

const MAX_ROTULO = 64;
const MAX_PROFUNDIDADE = 6;
const MAX_ITENS = 50;

export function omitido(valor: unknown): string {
  if (typeof valor === 'string') return `[texto omitido: ${valor.length} caracteres]`;
  if (Array.isArray(valor)) return `[conteúdo omitido: ${valor.length} itens]`;
  if (valor && typeof valor === 'object') return '[conteúdo omitido]';
  return '[conteúdo omitido]';
}

function rotuloTecnico(s: string): boolean {
  return s.length <= MAX_ROTULO && !/\s/.test(s);
}

export function mascararConteudo(valor: unknown, profundidade = 0): unknown {
  if (valor == null || typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'string') return rotuloTecnico(valor) ? valor : omitido(valor);
  if (profundidade >= MAX_PROFUNDIDADE) return omitido(valor);
  if (Array.isArray(valor)) {
    const itens = valor.slice(0, MAX_ITENS).map((v) => mascararConteudo(v, profundidade + 1));
    return valor.length > MAX_ITENS ? [...itens, `[+${valor.length - MAX_ITENS} itens]`] : itens;
  }
  if (typeof valor === 'object') {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
      saida[chave] =
        CHAVES_DE_CONTEUDO.has(chave.toLowerCase()) && v != null && typeof v !== 'number' && typeof v !== 'boolean'
          ? omitido(v)
          : mascararConteudo(v, profundidade + 1);
    }
    return saida;
  }
  return omitido(valor);
}
