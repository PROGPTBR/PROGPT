// Sub-projeto 35 — assistente de voz em tempo real no chat principal.
//
// Config da sessão OpenAI Realtime (gpt-realtime-mini, WebRTC direto do
// browser com token efêmero). A base RAG entra por tool calling: a sessão
// declara `buscar_base_conhecimento`; o browser executa a tool chamando
// /api/chat/voice/retrieve e devolve os trechos como function_call_output.

export const REALTIME_MODEL = 'gpt-realtime-mini';

/** Duração máxima de uma sessão de voz (TTL do token efêmero + timer no client). */
export const VOICE_SESSION_MAX_SECS = 600; // 10 min

/** Voz do consultor PROGPT (catálogo realtime da OpenAI). */
export const VOICE_NAME = 'echo';

export const SEARCH_TOOL_NAME = 'buscar_base_conhecimento';

// Tool no formato da Realtime API (flat, não o nested do Chat Completions).
export const SEARCH_TOOL = {
  type: 'function' as const,
  name: SEARCH_TOOL_NAME,
  description:
    'Busca trechos relevantes na base de conhecimento de procurement do PROGPT (artigos sobre frameworks, sourcing, negociação, gestão de fornecedores, custos, tributação). Chame SEMPRE antes de responder qualquer pergunta substantiva de procurement.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'A pergunta ou tópico a buscar, reformulada como consulta autônoma em português (ex.: "matriz de Kraljic quadrantes estratégias").',
      },
    },
    required: ['query'],
  },
};

// Persona falada — adaptada do SYSTEM_PROMPT do chat (lib/rag/prompt-builder.ts)
// pro runtime de voz. NÃO compartilha bytes com o original (runtime diferente,
// sem prefix cache de chat): aqui a regra de ouro é resposta CURTA e FALADA.
export function buildVoiceInstructions(): string {
  return `Você é o assistente de voz do PROGPT: um especialista sênior em procurement (compras corporativas) com 20 anos de experiência, conversando POR VOZ com um gestor de compras brasileiro. Referência teórica: Kraljic, Porter, Monczka, Cox, Cousins, Dyer, Williamson, Ellram — combinada com a realidade brasileira (Lei 14.133/2021, ICMS/PIS/Cofins, Reforma Tributária CBS/IBS).

# Regras de FALA (inegociáveis)
- Respostas CURTAS: 2 a 4 frases por vez. Isto é uma CONVERSA, não uma palestra. Depois de responder o essencial, convide a continuar ("quer que eu detalhe os quadrantes?", "quer um exemplo prático?").
- NUNCA use markdown, tabelas, listas numeradas ou bullets — você está FALANDO. Estruture com a fala ("primeiro... segundo...", "são quatro categorias: ...").
- Português brasileiro, tom profissional e direto, de par para par. Sem clichês ("ótima pergunta"), sem encerramentos prontos ("posso ajudar com mais algo?").
- Se o usuário interromper, pare e responda ao novo ponto.

# Regra de FUNDAMENTO (a mais importante)
- Para QUALQUER pergunta substantiva de procurement, chame a ferramenta ${SEARCH_TOOL_NAME} ANTES de responder, e fundamente a resposta nos trechos retornados.
- Se a busca não retornar nada relevante, diga explicitamente que não tem fonte na base sobre isso — pode oferecer o princípio geral, sinalizando ("em termos gerais...").
- NUNCA invente teoria, autor, framework ou data. Cite autor e ano quando o framework é o assunto ("a matriz de Kraljic, do Peter Kraljic, de 1983...").
- NÃO mencione a ferramenta de busca, "trechos", "base de dados" ou fontes pro usuário — responda como conhecimento fluente.

# Documentos anexados
Quando o usuário anexar um documento (contrato, proposta, planilha), o conteúdo entra na conversa como texto. Use-o como contexto primário pra perguntas sobre o documento.

# Fora de escopo
Smalltalk breve é ok (responda curto e traga de volta pra compras). Temas totalmente fora de procurement/supply: diga que seu foco é compras e suprimentos.`;
}

// Prompt de vocabulário pra transcrição não errar o jargão de procurement
// (o gpt-4o-*-transcribe aceita bias por prompt; whisper-1 era bem pior nisso).
export const TRANSCRIPTION_PROMPT =
  'Conversa sobre procurement e compras corporativas. Vocabulário: matriz de Kraljic, ' +
  'cinco forças de Porter, strategic sourcing, RFP, RFQ, RFI, savings, spend, ' +
  'curva ABC, supplier scorecard, SRM, TCO, BATNA, ZOPA, Incoterms, ' +
  'CBS, IBS, ICMS, PIS, Cofins, Lei 14.133.';

/** Shape do body de mint (POST /v1/realtime/client_secrets, GA 2025-08+). */
export function buildClientSecretRequest() {
  return {
    expires_after: { anchor: 'created_at', seconds: VOICE_SESSION_MAX_SECS },
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      instructions: buildVoiceInstructions(),
      tools: [SEARCH_TOOL],
      tool_choice: 'auto',
      audio: {
        input: {
          transcription: {
            model: 'gpt-4o-mini-transcribe',
            language: 'pt',
            prompt: TRANSCRIPTION_PROMPT,
          },
          noise_reduction: { type: 'near_field' },
          // semantic_vad espera o usuário TERMINAR A IDEIA (não só silêncio) —
          // server_vad cortava no meio de frases com pausa pra pensar.
          turn_detection: { type: 'semantic_vad' },
        },
        output: { voice: VOICE_NAME },
      },
    },
  };
}
