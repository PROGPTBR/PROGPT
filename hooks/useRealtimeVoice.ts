'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  reduceRealtimeEvent,
  emptyUsage,
  addUsage,
  type RealtimeUsage,
} from '@/lib/voice/event-reducer';
import { SEARCH_TOOL_NAME } from '@/lib/voice/realtime-config';

// Sub-projeto 35 — sessão de voz realtime do chat.
//
// WebRTC direto browser→OpenAI com token efêmero (mintado em
// /api/chat/voice/session). A tool `buscar_base_conhecimento` é executada
// AQUI: o modelo pede, a gente chama /api/chat/voice/retrieve e devolve os
// trechos via function_call_output. Usage acumulado dos response.done é
// postado em /api/chat/voice/usage no encerramento (custo no /admin/costs).

export type VoiceStatus = 'idle' | 'connecting' | 'live' | 'error';
export type VoiceTurn = { role: 'user' | 'assistant'; content: string };

type SessionInfo = {
  clientSecret: string;
  model: string;
  maxSecs: number;
};

export function useRealtimeVoice(opts: {
  /** Chamado no encerramento com o transcript completo da conversa. */
  onEnded?: (turns: VoiceTurn[]) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [partialAssistant, setPartialAssistant] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const usageRef = useRef<RealtimeUsage>(emptyUsage());
  const turnsRef = useRef<VoiceTurn[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const onEndedRef = useRef(opts.onEnded);
  onEndedRef.current = opts.onEnded;

  const postUsage = useCallback((useBeacon: boolean) => {
    const u = usageRef.current;
    const total = u.audioIn + u.audioOut + u.textIn + u.textOut;
    if (total === 0) return;
    const payload = JSON.stringify({
      ...u,
      durationSecs: startedAtRef.current
        ? Math.round((Date.now() - startedAtRef.current) / 1000)
        : 0,
    });
    usageRef.current = emptyUsage(); // evita double-post (stop + beacon)
    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/chat/voice/usage',
          new Blob([payload], { type: 'application/json' }),
        );
      } else {
        void fetch('/api/chat/voice/usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      }
    } catch {
      /* tracking nunca quebra a sessão */
    }
  }, []);

  const teardown = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    dcRef.current?.close();
    dcRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (audioElRef.current) {
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    setSpeaking(false);
    setSecondsLeft(null);
  }, []);

  const stop = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    postUsage(false);
    teardown();
    setStatus('idle');
    const finalTurns = turnsRef.current;
    if (finalTurns.length > 0) onEndedRef.current?.(finalTurns);
  }, [postUsage, teardown]);

  // Usage não pode se perder se a aba fechar no meio da conversa.
  useEffect(() => {
    const onUnload = () => postUsage(true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      postUsage(true);
      teardown();
    };
  }, [postUsage, teardown]);

  const pushTurn = useCallback((turn: VoiceTurn) => {
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
  }, []);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') dc.send(JSON.stringify(event));
  }, []);

  const runTool = useCallback(
    async (callId: string, name: string, rawArgs: string) => {
      let output = JSON.stringify({ context: '' });
      if (name === SEARCH_TOOL_NAME) {
        try {
          const args = JSON.parse(rawArgs || '{}') as { query?: string };
          const query = (args.query ?? '').trim();
          if (query) {
            const res = await fetch('/api/chat/voice/retrieve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query }),
            });
            if (res.ok) {
              const data = (await res.json()) as { context: string };
              output = JSON.stringify({ context: data.context });
            }
          }
        } catch {
          /* fail-soft: devolve contexto vazio; o prompt manda sinalizar */
        }
      }
      sendEvent({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output },
      });
      sendEvent({ type: 'response.create' });
    },
    [sendEvent],
  );

  const handleServerEvent = useCallback(
    (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return;
      }
      for (const effect of reduceRealtimeEvent(parsed)) {
        switch (effect.kind) {
          case 'user_transcript':
            pushTurn({ role: 'user', content: effect.text });
            break;
          case 'assistant_delta':
            setPartialAssistant((prev) => prev + effect.delta);
            break;
          case 'assistant_done':
            setPartialAssistant('');
            pushTurn({ role: 'assistant', content: effect.text });
            break;
          case 'tool_call':
            void runTool(effect.callId, effect.name, effect.args);
            break;
          case 'usage':
            usageRef.current = addUsage(usageRef.current, effect.usage);
            break;
          case 'speech_started':
            setSpeaking(false); // barge-in: usuário falou por cima
            break;
          case 'speaking_started':
            setSpeaking(true);
            break;
          case 'speaking_stopped':
            setSpeaking(false);
            break;
          case 'error':
            console.warn('[voice] realtime error:', effect.message);
            break;
        }
      }
    },
    [pushTurn, runTool],
  );

  const start = useCallback(async (): Promise<boolean> => {
    if (status === 'connecting' || status === 'live') return false;
    endedRef.current = false;
    turnsRef.current = [];
    setTurns([]);
    setPartialAssistant('');
    setError(null);
    usageRef.current = emptyUsage();
    setStatus('connecting');

    try {
      // 1) Token efêmero (auth + rate-limit do chat acontecem no servidor)
      const sessRes = await fetch('/api/chat/voice/session', { method: 'POST' });
      if (sessRes.status === 429) {
        const data = (await sessRes.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        throw new Error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
      }
      if (!sessRes.ok) throw new Error('Não foi possível iniciar a sessão de voz.');
      const session = (await sessRes.json()) as SessionInfo;

      // 2) Microfone (o clique do usuário é o gesture do getUserMedia)
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;

      // 3) WebRTC direto na OpenAI
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      const audioEl = new Audio();
      audioEl.autoplay = true;
      audioElRef.current = audioEl;
      pc.ontrack = (ev) => {
        audioEl.srcObject = ev.streams[0] ?? null;
      };
      for (const track of mic.getTracks()) pc.addTrack(track, mic);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.onmessage = (ev) => handleServerEvent(String(ev.data));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(session.model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );
      if (!sdpRes.ok) throw new Error('Falha na conexão de voz (WebRTC).');
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // 4) Timer da sessão (cap de custo)
      startedAtRef.current = Date.now();
      setSecondsLeft(session.maxSecs);
      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startedAtRef.current) / 1000);
        const left = Math.max(0, session.maxSecs - elapsed);
        setSecondsLeft(left);
        if (left <= 0) stop();
      }, 1000);

      setStatus('live');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      teardown();
      setStatus('error');
      return false;
    }
  }, [status, handleServerEvent, stop, teardown]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      micRef.current?.getAudioTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  /** Injeta um documento parseado como contexto da conversa (sem disparar resposta). */
  const attachDocument = useCallback(
    (filename: string, parsedText: string) => {
      sendEvent({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `[Documento anexado: "${filename}"]\n\n${parsedText}`,
            },
          ],
        },
      });
    },
    [sendEvent],
  );

  return {
    status,
    error,
    speaking,
    muted,
    turns,
    partialAssistant,
    secondsLeft,
    start,
    stop,
    toggleMute,
    attachDocument,
  };
}
