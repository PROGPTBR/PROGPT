// Sub-projeto 35 — assistente de voz em tempo real no chat principal.
//
// Config da sessão OpenAI Realtime (gpt-realtime-mini, WebRTC direto do
// browser com token efêmero). A base RAG entra por tool calling: a sessão
// declara `buscar_base_conhecimento`; o browser executa a tool chamando
// /api/chat/voice/retrieve e devolve os trechos como function_call_output.

export const REALTIME_MODEL = 'gpt-realtime-mini';

/** Duração máxima de uma sessão de voz (TTL do token efêmero + timer no client). */
export const VOICE_SESSION_MAX_SECS = 600; // 10 min

/**
 * Vozes do consultor PROGPT (catálogo realtime da OpenAI; todas validadas
 * no mint com gpt-realtime-mini). O usuário escolhe no overlay de voz;
 * o servidor valida contra esta lista — nunca aceita string livre do client.
 */
export const VOICE_OPTIONS = [
  { id: 'echo', label: 'Echo', description: 'Masculina · firme' },
  { id: 'cedar', label: 'Cedar', description: 'Masculina · natural' },
  { id: 'ash', label: 'Ash', description: 'Masculina · grave' },
  { id: 'marin', label: 'Marin', description: 'Feminina · natural' },
  { id: 'sage', label: 'Sage', description: 'Feminina · suave' },
  { id: 'coral', label: 'Coral', description: 'Feminina · calorosa' },
] as const;

export type VoiceName = (typeof VOICE_OPTIONS)[number]['id'];

export const DEFAULT_VOICE: VoiceName = 'echo';

export function isVoiceName(v: unknown): v is VoiceName {
  return typeof v === 'string' && VOICE_OPTIONS.some((o) => o.id === v);
}

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

export const FISCAL_TOOL_NAME = 'consultar_dados_fiscais';

// Tool de consulta fiscal por CNPJ (sub-projeto 36 fase 4).
export const FISCAL_TOOL = {
  type: 'function' as const,
  name: FISCAL_TOOL_NAME,
  description:
    'Consulta dados oficiais de um fornecedor pelo CNPJ na Receita (BrasilAPI): razão social, situação cadastral (ativa/suspensa/inapta/baixada) e um score de risco fiscal. Chame sempre que o usuário pedir para validar, verificar, homologar ou consultar um CNPJ ou a situação de um fornecedor.',
  parameters: {
    type: 'object',
    properties: {
      cnpj: {
        type: 'string',
        description:
          'O CNPJ a consultar — apenas os 14 dígitos ou formatado (ex.: "11.222.333/0001-81" ou "11222333000181").',
      },
    },
    required: ['cnpj'],
  },
};

export const INDICADORES_TOOL_NAME = 'consultar_indicadores_economicos';

// Tool de indicadores econômicos (sub-projeto 37 fase 3) — BACEN.
export const INDICADORES_TOOL = {
  type: 'function' as const,
  name: INDICADORES_TOOL_NAME,
  description:
    'Consulta os indicadores econômicos brasileiros atuais no Banco Central: taxa Selic (meta), IPCA acumulado em 12 meses e câmbio do dólar. Chame quando o usuário perguntar sobre juros, Selic, inflação, IPCA, índice de preços, dólar/câmbio, reajuste contratual ou correção monetária.',
  parameters: {
    type: 'object',
    properties: {},
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

# Consulta fiscal por CNPJ
Quando o usuário pedir para validar, verificar, homologar ou consultar um CNPJ ou a situação de um fornecedor, chame a ferramenta ${FISCAL_TOOL_NAME} com o CNPJ e relate de forma curta e falada a situação cadastral e o risco. Se a consulta não retornar dados, diga que não conseguiu consultar agora.

# Indicadores econômicos
Quando o usuário perguntar sobre Selic, juros, inflação, IPCA, dólar/câmbio, reajuste contratual ou correção monetária, chame a ferramenta ${INDICADORES_TOOL_NAME} (sem argumentos) e relate os números atuais de forma curta e falada. Use-os para fundamentar conversas sobre reajuste de preços e custo.

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
export function buildClientSecretRequest(voice: VoiceName = DEFAULT_VOICE) {
  return {
    expires_after: { anchor: 'created_at', seconds: VOICE_SESSION_MAX_SECS },
    session: {
      type: 'realtime',
      model: REALTIME_MODEL,
      instructions: buildVoiceInstructions(),
      tools: [SEARCH_TOOL, FISCAL_TOOL, INDICADORES_TOOL],
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
        output: { voice },
      },
    },
  };
}
