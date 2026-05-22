'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { toast } from 'sonner';

// Cap defensivo no cliente — backend repete com MAX_DURATION_SECS=120.
const MAX_DURATION_MS = 120_000;
const TICK_MS = 200;

type RecorderState =
  | { kind: 'idle' }
  | { kind: 'requesting' } // pedindo permissão do mic
  | { kind: 'recording'; elapsedMs: number }
  | { kind: 'transcribing' };

type Props = {
  /** Variante visual — bate com o tamanho dos outros botões do Composer. */
  size?: 'sm' | 'lg';
  /** Chamado com o transcript de sucesso. Recebe a string já trimmed. */
  onTranscript: (text: string) => void;
  /** Quando true, o botão fica disabled (ex: chat gerando). */
  disabled?: boolean;
};

function pickAudioMime(): string {
  // MediaRecorder.isTypeSupported existe em browsers modernos.
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
    return 'audio/webm';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg;codecs=opus',
  ];
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'audio/webm';
}

function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MicRecorderButton({
  size = 'lg',
  onTranscript,
  disabled,
}: Props) {
  const [state, setState] = useState<RecorderState>({ kind: 'idle' });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Cleanup ao desmontar — solta o mic, mata timer.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
      }
    };
  }, []);

  const sendForTranscription = useCallback(
    async (blob: Blob) => {
      setState({ kind: 'transcribing' });
      try {
        const fd = new FormData();
        const ext = blob.type.includes('mp4')
          ? 'm4a'
          : blob.type.includes('mpeg')
            ? 'mp3'
            : blob.type.includes('ogg')
              ? 'ogg'
              : 'webm';
        fd.append('audio', blob, `voice.${ext}`);
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
        if (res.status === 429) {
          const data = (await res.json().catch(() => ({}))) as {
            retry_after_secs?: number;
          };
          toast.error(
            `Limite de transcrição atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
          );
          return;
        }
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          toast.error('Falha na transcrição', {
            description: data.error ?? `status ${res.status}`,
          });
          return;
        }
        const data = (await res.json()) as { transcript: string };
        const t = (data.transcript ?? '').trim();
        if (!t) {
          toast.error('Não entendi o áudio', {
            description: 'Tente falar mais alto ou mais perto do microfone.',
          });
          return;
        }
        onTranscript(t);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Erro na transcrição', { description: msg });
      } finally {
        setState({ kind: 'idle' });
      }
    },
    [onTranscript],
  );

  const stop = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    } else {
      // Não tava gravando — solta o mic e volta ao idle.
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      setState({ kind: 'idle' });
    }
  }, []);

  const start = useCallback(async () => {
    if (state.kind !== 'idle') return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      toast.error('Microfone não suportado neste navegador.');
      return;
    }
    setState({ kind: 'requesting' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickAudioMime();
      const rec = new MediaRecorder(stream, { mimeType });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        // Solta o mic imediatamente.
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) track.stop();
          streamRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size === 0) {
          setState({ kind: 'idle' });
          return;
        }
        void sendForTranscription(blob);
      };

      startedAtRef.current = Date.now();
      rec.start();
      setState({ kind: 'recording', elapsedMs: 0 });

      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        if (elapsed >= MAX_DURATION_MS) {
          stop();
          return;
        }
        setState({ kind: 'recording', elapsedMs: elapsed });
      }, TICK_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('NotAllowed') ||
        msg.includes('Permission') ||
        msg.includes('denied')
      ) {
        toast.error('Permissão negada', {
          description: 'Habilite o microfone nas configurações do navegador.',
        });
      } else {
        toast.error('Falha ao acessar microfone', { description: msg });
      }
      setState({ kind: 'idle' });
    }
  }, [sendForTranscription, state.kind, stop]);

  const dim = size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';
  const iconSize = size === 'lg' ? 'h-4 w-4' : 'h-4 w-4';

  if (state.kind === 'recording') {
    return (
      <button
        type="button"
        onClick={stop}
        aria-label="Parar gravação e transcrever"
        title={`Gravando ${formatElapsed(state.elapsedMs)} — clique pra transcrever`}
        className={`${dim} relative inline-flex items-center justify-center rounded-full bg-red-500/15 border border-red-500/50 text-red-600 hover:bg-red-500/25 transition-all duration-150 active:scale-95 flex-shrink-0`}
      >
        <Square className={`${iconSize} fill-current`} aria-hidden="true" />
        <span
          aria-hidden="true"
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse"
        />
      </button>
    );
  }

  if (state.kind === 'transcribing' || state.kind === 'requesting') {
    return (
      <button
        type="button"
        disabled
        aria-label={state.kind === 'transcribing' ? 'Transcrevendo…' : 'Aguardando microfone…'}
        title={state.kind === 'transcribing' ? 'Transcrevendo…' : 'Aguardando microfone…'}
        className={`${dim} inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent transition-colors flex-shrink-0 ${
          size === 'lg' ? 'border border-border bg-muted/40' : ''
        }`}
      >
        <Loader2 className={`${iconSize} animate-spin`} aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={disabled}
      aria-label="Gravar voz"
      title="Falar (transcreve via Whisper)"
      className={`${dim} inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
        size === 'lg' ? 'border border-border bg-muted/40' : ''
      }`}
    >
      <Mic className={iconSize} aria-hidden="true" />
    </button>
  );
}
