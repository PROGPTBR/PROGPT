// Sub-projeto 35 — tradução dos eventos do data channel da OpenAI Realtime
// em "efeitos" tipados que o hook useRealtimeVoice consome. Puro e testável.
//
// Robusto a variações beta→GA de nomes (ex.: response.audio_transcript.delta
// virou response.output_audio_transcript.delta no GA) — aceitamos ambos.

export type RealtimeUsage = {
  audioIn: number;
  audioOut: number;
  textIn: number;
  textOut: number;
  cachedIn: number;
};

export type VoiceEffect =
  | { kind: 'user_transcript'; text: string }
  | { kind: 'assistant_delta'; delta: string }
  | { kind: 'assistant_done'; text: string }
  | { kind: 'tool_call'; callId: string; name: string; args: string }
  | { kind: 'usage'; usage: RealtimeUsage }
  | { kind: 'speech_started' }
  | { kind: 'speaking_started' }
  | { kind: 'speaking_stopped' }
  | { kind: 'error'; message: string };

type AnyEvent = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * Reduz UM evento do servidor em zero ou mais efeitos. Eventos desconhecidos
 * retornam [] (forward-compat — a API adiciona eventos sem quebrar a gente).
 */
export function reduceRealtimeEvent(event: unknown): VoiceEffect[] {
  if (!event || typeof event !== 'object') return [];
  const e = event as AnyEvent;
  const type = str(e.type);
  if (!type) return [];

  // Transcrição da fala do USUÁRIO (whisper sobre o áudio de entrada).
  if (type === 'conversation.item.input_audio_transcription.completed') {
    const text = str(e.transcript).trim();
    return text ? [{ kind: 'user_transcript', text }] : [];
  }

  // Transcrição da fala do ASSISTENTE (delta + done; nomes GA e beta).
  if (
    type === 'response.output_audio_transcript.delta' ||
    type === 'response.audio_transcript.delta'
  ) {
    const delta = str(e.delta);
    return delta ? [{ kind: 'assistant_delta', delta }] : [];
  }
  if (
    type === 'response.output_audio_transcript.done' ||
    type === 'response.audio_transcript.done'
  ) {
    const text = str(e.transcript).trim();
    return text ? [{ kind: 'assistant_done', text }] : [];
  }

  // Estado de turno: usuário começou a falar (também é o sinal de barge-in).
  if (type === 'input_audio_buffer.speech_started') {
    return [{ kind: 'speech_started' }];
  }

  // Playout do áudio remoto (WebRTC GA emite started/stopped do buffer).
  if (type === 'output_audio_buffer.started') return [{ kind: 'speaking_started' }];
  if (type === 'output_audio_buffer.stopped' || type === 'output_audio_buffer.cleared') {
    return [{ kind: 'speaking_stopped' }];
  }

  // Fim de uma response: extrai tool calls pendentes + usage acumulável.
  if (type === 'response.done') {
    const out: VoiceEffect[] = [];
    const response = (e.response ?? {}) as AnyEvent;

    const items = Array.isArray(response.output) ? response.output : [];
    for (const raw of items) {
      const item = (raw ?? {}) as AnyEvent;
      if (str(item.type) === 'function_call') {
        const callId = str(item.call_id);
        const name = str(item.name);
        if (callId && name) {
          out.push({ kind: 'tool_call', callId, name, args: str(item.arguments) });
        }
      }
    }

    const usage = (response.usage ?? null) as AnyEvent | null;
    if (usage) {
      const inDet = (usage.input_token_details ?? {}) as AnyEvent;
      const outDet = (usage.output_token_details ?? {}) as AnyEvent;
      out.push({
        kind: 'usage',
        usage: {
          audioIn: num(inDet.audio_tokens),
          audioOut: num(outDet.audio_tokens),
          textIn: num(inDet.text_tokens),
          textOut: num(outDet.text_tokens),
          cachedIn: num(inDet.cached_tokens),
        },
      });
    }
    return out;
  }

  if (type === 'error') {
    const err = (e.error ?? {}) as AnyEvent;
    return [{ kind: 'error', message: str(err.message) || 'realtime error' }];
  }

  return [];
}

export function emptyUsage(): RealtimeUsage {
  return { audioIn: 0, audioOut: 0, textIn: 0, textOut: 0, cachedIn: 0 };
}

export function addUsage(a: RealtimeUsage, b: RealtimeUsage): RealtimeUsage {
  return {
    audioIn: a.audioIn + b.audioIn,
    audioOut: a.audioOut + b.audioOut,
    textIn: a.textIn + b.textIn,
    textOut: a.textOut + b.textOut,
    cachedIn: a.cachedIn + b.cachedIn,
  };
}
