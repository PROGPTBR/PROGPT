import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VOICE,
  REALTIME_MODEL,
  VOICE_OPTIONS,
  VOICE_SESSION_MAX_SECS,
  SEARCH_TOOL,
  SEARCH_TOOL_NAME,
  buildVoiceInstructions,
  buildClientSecretRequest,
  isVoiceName,
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

  it('client secret request: TTL de 10 min, modelo mini, transcrição PT, semantic VAD', () => {
    const req = buildClientSecretRequest();
    expect(req.expires_after).toEqual({ anchor: 'created_at', seconds: VOICE_SESSION_MAX_SECS });
    expect(req.session.model).toBe(REALTIME_MODEL);
    expect(REALTIME_MODEL).toBe('gpt-realtime-mini');
    expect(req.session.audio.input.transcription.language).toBe('pt');
    // SEARCH_TOOL + FISCAL_TOOL + INDICADORES_TOOL (sub-projetos 36 fase 4, 37 fase 3)
    expect(req.session.tools).toHaveLength(3);
    const toolNames = req.session.tools.map((t) => t.name);
    expect(toolNames).toContain('consultar_dados_fiscais');
    expect(toolNames).toContain('consultar_indicadores_economicos');
  });

  it('reconhecimento de fala: transcribe moderno + prompt de jargão + noise reduction + semantic VAD', () => {
    const req = buildClientSecretRequest();
    const input = req.session.audio.input;
    // whisper-1 errava o jargão de procurement em PT-BR (feedback 2026-06-10)
    expect(input.transcription.model).toBe('gpt-4o-mini-transcribe');
    expect(input.transcription.prompt).toMatch(/Kraljic/);
    expect(input.transcription.prompt).toMatch(/RFP/);
    expect(input.noise_reduction).toEqual({ type: 'near_field' });
    // server_vad cortava no meio de frases com pausa pra pensar
    expect(input.turn_detection.type).toBe('semantic_vad');
  });

  it('escolha de voz: catálogo válido, default no catálogo, override aplicado no request', () => {
    expect(VOICE_OPTIONS.length).toBeGreaterThanOrEqual(4);
    const ids = VOICE_OPTIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length); // sem duplicatas
    expect(isVoiceName(DEFAULT_VOICE)).toBe(true);
    expect(isVoiceName('marin')).toBe(true);
    expect(isVoiceName('hacker-voice')).toBe(false);
    expect(isVoiceName(null)).toBe(false);

    expect(buildClientSecretRequest().session.audio.output.voice).toBe(DEFAULT_VOICE);
    expect(buildClientSecretRequest('marin').session.audio.output.voice).toBe('marin');
  });
});
