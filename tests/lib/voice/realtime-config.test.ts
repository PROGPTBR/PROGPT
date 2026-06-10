import { describe, expect, it } from 'vitest';
import {
  REALTIME_MODEL,
  VOICE_SESSION_MAX_SECS,
  SEARCH_TOOL,
  SEARCH_TOOL_NAME,
  buildVoiceInstructions,
  buildClientSecretRequest,
} from '@/lib/voice/realtime-config';

describe('realtime-config', () => {
  it('instructions exigem fundamento via tool + fala curta + PT-BR + não inventar', () => {
    const s = buildVoiceInstructions();
    expect(s).toContain(SEARCH_TOOL_NAME);
    expect(s).toMatch(/2 a 4 frases/);
    expect(s).toMatch(/Português brasileiro|português/i);
    expect(s).toMatch(/NUNCA invente/i);
    expect(s).toMatch(/não tem fonte/i);
    // É voz: proíbe markdown/tabelas
    expect(s).toMatch(/markdown/i);
  });

  it('tool de busca tem o shape flat da Realtime API (name/parameters no topo)', () => {
    expect(SEARCH_TOOL.type).toBe('function');
    expect(SEARCH_TOOL.name).toBe(SEARCH_TOOL_NAME);
    expect(SEARCH_TOOL.parameters.required).toEqual(['query']);
  });

  it('client secret request: TTL de 10 min, modelo mini, transcrição PT, server VAD', () => {
    const req = buildClientSecretRequest();
    expect(req.expires_after).toEqual({ anchor: 'created_at', seconds: VOICE_SESSION_MAX_SECS });
    expect(req.session.model).toBe(REALTIME_MODEL);
    expect(REALTIME_MODEL).toBe('gpt-realtime-mini');
    expect(req.session.audio.input.transcription.language).toBe('pt');
    expect(req.session.audio.input.turn_detection.type).toBe('server_vad');
    expect(req.session.tools).toHaveLength(1);
  });
});
