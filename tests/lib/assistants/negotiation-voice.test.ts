import { describe, expect, it } from 'vitest';
import {
  voiceForPersona,
  TTS_MODEL,
  TTS_MAX_INPUT_CHARS,
} from '@/lib/assistants/negotiation/voice';
import { NEGOTIATION_PERSONA_PROFILE } from '@/lib/assistants/types';

describe('voiceForPersona', () => {
  it('toda persona tem voz e instruções em PT-BR', () => {
    for (const p of NEGOTIATION_PERSONA_PROFILE) {
      const v = voiceForPersona(p);
      expect(v.voice.length).toBeGreaterThan(0);
      expect(v.instructions).toMatch(/português/i);
      expect(v.instructions).toMatch(/negocia/i);
    }
  });

  it('agressivo e colaborativo soam diferentes (voz ou instrução distinta)', () => {
    const a = voiceForPersona('agressivo');
    const c = voiceForPersona('colaborativo');
    expect(a.voice === c.voice && a.instructions === c.instructions).toBe(false);
    expect(a.instructions).toMatch(/firme|impaciente/i);
    expect(c.instructions).toMatch(/caloroso|ganha-ganha/i);
  });

  it('persona ausente/desconhecida cai no default', () => {
    expect(voiceForPersona(null).voice.length).toBeGreaterThan(0);
    expect(voiceForPersona(undefined).voice.length).toBeGreaterThan(0);
  });

  it('constantes do TTS exportadas (modelo + cap de input)', () => {
    expect(TTS_MODEL).toBe('gpt-4o-mini-tts');
    expect(TTS_MAX_INPUT_CHARS).toBe(4000);
  });
});
