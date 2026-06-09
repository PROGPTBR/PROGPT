import type { NegotiationPersonaProfile } from '@/lib/assistants/types';

// Sub-projeto 34 — modo voz do simulador de negociação.
//
// Mapa persona → voz + instruções de entrega pro gpt-4o-mini-tts (TTS
// "steerable": aceita `instructions` de tom/ritmo). A voz dá identidade ao
// fornecedor simulado — um "agressivo" soa firme e impaciente; um
// "relacional" soa caloroso e pausado. Vozes do catálogo OpenAI.

export const TTS_MODEL = 'gpt-4o-mini-tts';

/** Cap defensivo do texto sintetizado por chamada (~3-4 min de fala). */
export const TTS_MAX_INPUT_CHARS = 4000;

export type PersonaVoice = {
  /** Voz do catálogo OpenAI (alloy/ash/echo/nova/onyx/sage/shimmer/...). */
  voice: string;
  /** Instruções de entrega (tom, ritmo, atitude) pro TTS steerable. */
  instructions: string;
};

const VOICES: Record<NegotiationPersonaProfile, PersonaVoice> = {
  agressivo: {
    voice: 'onyx',
    instructions:
      'Você é um vendedor agressivo numa reunião de negociação. Fale em português brasileiro, tom firme, levemente impaciente, ritmo rápido, assertivo — sem soar caricato ou gritado.',
  },
  colaborativo: {
    voice: 'nova',
    instructions:
      'Você é um vendedor colaborativo numa reunião de negociação. Fale em português brasileiro, tom caloroso e construtivo, ritmo natural, transmitindo abertura pra ganha-ganha mas com firmeza nos interesses.',
  },
  pragmatico: {
    voice: 'echo',
    instructions:
      'Você é um vendedor pragmático numa reunião de negociação. Fale em português brasileiro, tom objetivo e eficiente, ritmo ágil, direto ao ponto, sem floreios.',
  },
  rigido: {
    voice: 'ash',
    instructions:
      'Você é um vendedor rígido numa reunião de negociação. Fale em português brasileiro, tom formal e monocórdio, ritmo medido, como quem repete a política da empresa sem improvisar.',
  },
  relacional: {
    voice: 'shimmer',
    instructions:
      'Você é um vendedor relacional numa reunião de negociação. Fale em português brasileiro, tom caloroso e pausado, transmitindo confiança e visão de longo prazo.',
  },
};

const DEFAULT_VOICE: PersonaVoice = {
  voice: 'echo',
  instructions:
    'Você é um vendedor numa reunião de negociação. Fale em português brasileiro, tom profissional e natural.',
};

export function voiceForPersona(
  persona: NegotiationPersonaProfile | undefined | null,
): PersonaVoice {
  if (!persona) return DEFAULT_VOICE;
  return VOICES[persona] ?? DEFAULT_VOICE;
}
