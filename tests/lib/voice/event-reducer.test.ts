import { describe, expect, it } from 'vitest';
import {
  reduceRealtimeEvent,
  emptyUsage,
  addUsage,
} from '@/lib/voice/event-reducer';

describe('reduceRealtimeEvent', () => {
  it('transcrição do usuário (input_audio_transcription.completed)', () => {
    const fx = reduceRealtimeEvent({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: ' o que é kraljic? ',
    });
    expect(fx).toEqual([{ kind: 'user_transcript', text: 'o que é kraljic?' }]);
  });

  it('transcrição do assistente: aceita nome GA e nome beta', () => {
    const ga = reduceRealtimeEvent({
      type: 'response.output_audio_transcript.delta',
      delta: 'A matriz',
    });
    const beta = reduceRealtimeEvent({
      type: 'response.audio_transcript.delta',
      delta: ' de Kraljic',
    });
    expect(ga).toEqual([{ kind: 'assistant_delta', delta: 'A matriz' }]);
    expect(beta).toEqual([{ kind: 'assistant_delta', delta: ' de Kraljic' }]);
    const done = reduceRealtimeEvent({
      type: 'response.output_audio_transcript.done',
      transcript: 'A matriz de Kraljic...',
    });
    expect(done).toEqual([{ kind: 'assistant_done', text: 'A matriz de Kraljic...' }]);
  });

  it('response.done extrai tool calls + usage por modalidade', () => {
    const fx = reduceRealtimeEvent({
      type: 'response.done',
      response: {
        output: [
          { type: 'message', content: [] },
          {
            type: 'function_call',
            call_id: 'call_1',
            name: 'buscar_base_conhecimento',
            arguments: '{"query":"matriz de kraljic"}',
          },
        ],
        usage: {
          input_token_details: { audio_tokens: 500, text_tokens: 1200, cached_tokens: 800 },
          output_token_details: { audio_tokens: 300, text_tokens: 50 },
        },
      },
    });
    expect(fx).toEqual([
      {
        kind: 'tool_call',
        callId: 'call_1',
        name: 'buscar_base_conhecimento',
        args: '{"query":"matriz de kraljic"}',
      },
      {
        kind: 'usage',
        usage: { audioIn: 500, audioOut: 300, textIn: 1200, textOut: 50, cachedIn: 800 },
      },
    ]);
  });

  it('speech_started (barge-in) e playout started/stopped', () => {
    expect(reduceRealtimeEvent({ type: 'input_audio_buffer.speech_started' })).toEqual([
      { kind: 'speech_started' },
    ]);
    expect(reduceRealtimeEvent({ type: 'output_audio_buffer.started' })).toEqual([
      { kind: 'speaking_started' },
    ]);
    expect(reduceRealtimeEvent({ type: 'output_audio_buffer.stopped' })).toEqual([
      { kind: 'speaking_stopped' },
    ]);
  });

  it('erro vira efeito de erro; eventos desconhecidos/garbage viram []', () => {
    expect(reduceRealtimeEvent({ type: 'error', error: { message: 'boom' } })).toEqual([
      { kind: 'error', message: 'boom' },
    ]);
    expect(reduceRealtimeEvent({ type: 'algum.evento.novo.do.futuro' })).toEqual([]);
    expect(reduceRealtimeEvent(null)).toEqual([]);
    expect(reduceRealtimeEvent('not an object')).toEqual([]);
  });
});

describe('usage helpers', () => {
  it('addUsage soma campo a campo', () => {
    const a = { audioIn: 1, audioOut: 2, textIn: 3, textOut: 4, cachedIn: 5 };
    const sum = addUsage(addUsage(emptyUsage(), a), a);
    expect(sum).toEqual({ audioIn: 2, audioOut: 4, textIn: 6, textOut: 8, cachedIn: 10 });
  });
});
