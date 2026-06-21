'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  AudioLines,
  Loader2,
  Mic,
  MicOff,
  Paperclip,
  PhoneOff,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRealtimeVoice, type VoiceTurn } from '@/hooks/useRealtimeVoice';
import {
  DEFAULT_VOICE,
  VOICE_OPTIONS,
  isVoiceName,
  type VoiceName,
} from '@/lib/voice/realtime-config';
import type { ChatAttachment } from '@/components/chat/Composer';

const VOICE_STORAGE_KEY = 'progpt_chat_voice_v1';

function loadStoredVoice(): VoiceName {
  try {
    const v = localStorage.getItem(VOICE_STORAGE_KEY);
    return isVoiceName(v) ? v : DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}

// Sub-projeto 35 — overlay da conversa de voz em tempo real.
// Abre por clique (gesture pro getUserMedia), mostra estado ouvindo/falando +
// transcript ao vivo, permite anexar documento (vira contexto da conversa) e
// mutar. Ao encerrar, devolve o transcript pro chat (vira histórico normal).

type Props = {
  onClose: (turns: VoiceTurn[]) => void;
};

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceMode({ onClose }: Props) {
  const closedRef = useRef(false);
  const [voiceName, setVoiceName] = useState<VoiceName>(loadStoredVoice);
  // Trocar a voz no meio da conversa reconecta a sessão (a Realtime API não
  // muda a voz depois que o modelo já falou). Os turnos do trecho anterior
  // ficam arquivados aqui pra compor o transcript final.
  const archivedRef = useRef<VoiceTurn[]>([]);
  const [archivedTurns, setArchivedTurns] = useState<VoiceTurn[]>([]);
  const restartingRef = useRef(false);

  const voice = useRealtimeVoice({
    onEnded: (turns) => {
      if (closedRef.current || restartingRef.current) return;
      closedRef.current = true;
      onClose([...archivedRef.current, ...turns]);
    },
  });
  const { status, error, speaking, muted, turns, partialAssistant, secondsLeft } =
    voice;

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-start no mount (o clique que abriu o overlay é o gesture).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void voice.start(voiceName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeVoice(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (!isVoiceName(v) || v === voiceName) return;
    setVoiceName(v);
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, v);
    } catch {
      /* preferência só não persiste */
    }
    if (status === 'live') {
      restartingRef.current = true;
      archivedRef.current = [...archivedRef.current, ...turns];
      setArchivedTurns(archivedRef.current);
      voice.stop();
      const label = VOICE_OPTIONS.find((o) => o.id === v)?.label ?? v;
      toast.info(`Voz alterada para ${label}`, {
        description: 'Reconectando a conversa…',
      });
      void voice.start(v).finally(() => {
        restartingRef.current = false;
      });
    }
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, archivedTurns, partialAssistant]);

  function endSession() {
    if (status === 'live' || status === 'connecting') {
      voice.stop(); // dispara onEnded → onClose(arquivados + turns)
      // se não houve turnos neste trecho, onEnded não chama onClose — fecha manualmente
      if (turns.length === 0 && !closedRef.current) {
        closedRef.current = true;
        onClose(archivedRef.current);
      }
    } else {
      closedRef.current = true;
      onClose([...archivedRef.current, ...turns]);
    }
  }

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/chat/attachments', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as
        | ChatAttachment
        | { error: string };
      if (!res.ok || 'error' in data) {
        toast.error('Falha ao processar o documento');
        return;
      }
      voice.attachDocument(data.filename, data.parsedText);
      toast.success(`"${data.filename}" anexado à conversa`, {
        description: 'Pergunte sobre o documento por voz.',
      });
    } catch (err) {
      toast.error('Falha ao enviar', { description: String(err) });
    } finally {
      setUploading(false);
    }
  }

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void handleFile(f);
  }

  const statusLabel =
    status === 'connecting'
      ? 'Conectando…'
      : status === 'error'
        ? (error ?? 'Erro na conexão')
        : speaking
          ? 'Falando…'
          : muted
            ? 'Microfone mudo'
            : 'Ouvindo você';

  return (
    <div
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-label="Conversa por voz com o assistente"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <AudioLines className="h-4 w-4 text-brand" aria-hidden="true" />
          Conversa por voz
          {secondsLeft != null && (
            <span
              className={`ml-2 text-xs tabular-nums ${
                secondsLeft <= 60 ? 'text-red-500 font-semibold' : 'text-muted-foreground'
              }`}
            >
              {fmtTime(secondsLeft)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={voiceName}
            onChange={changeVoice}
            disabled={status === 'connecting'}
            aria-label="Voz do assistente"
            title="Trocar a voz do assistente"
            className="h-8 max-w-[180px] rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50"
          >
            {VOICE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {o.description}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={endSession}
            aria-label="Fechar conversa por voz"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Status orb */}
      <div className="flex flex-col items-center gap-3 py-8">
        <div
          className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-500 ${
            status === 'connecting'
              ? 'bg-muted'
              : speaking
                ? 'bg-brand/20 ring-8 ring-brand/10'
                : 'bg-brand/10 ring-4 ring-brand/5'
          }`}
          aria-hidden="true"
        >
          {status === 'connecting' ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : speaking ? (
            <AudioLines className="h-8 w-8 text-brand animate-pulse" />
          ) : (
            <Mic className={`h-8 w-8 ${muted ? 'text-muted-foreground' : 'text-brand'}`} />
          )}
        </div>
        <div className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusLabel}
        </div>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => void voice.start(voiceName)}
            className="text-xs text-brand underline underline-offset-2"
          >
            Tentar de novo
          </button>
        )}
      </div>

      {/* Transcript ao vivo */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pb-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {archivedTurns.length === 0 && turns.length === 0 && !partialAssistant && status === 'live' && (
            <p className="text-center text-sm text-muted-foreground pt-4">
              Pode falar — pergunte qualquer coisa de compras e suprimentos.
              <br />
              Anexe um contrato ou proposta no clipe pra conversar sobre ele.
            </p>
          )}
          {[...archivedTurns, ...turns].map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words ${
                  t.role === 'user'
                    ? 'bg-brand text-black font-medium'
                    : 'bg-muted text-foreground/90'
                }`}
              >
                {t.content}
              </div>
            </div>
          ))}
          {partialAssistant && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm bg-muted text-foreground/70 whitespace-pre-wrap break-words">
                {partialAssistant}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Controles */}
      <div className="border-t border-border px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onFileInputChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || status !== 'live'}
            aria-label="Anexar documento à conversa"
            title="Anexar contrato/proposta (PDF, DOCX, XLSX)"
            className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent transition-all active:scale-95 disabled:opacity-40"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={voice.toggleMute}
            disabled={status !== 'live'}
            aria-pressed={muted}
            aria-label={muted ? 'Reativar microfone' : 'Mutar microfone'}
            className={`inline-flex items-center justify-center w-12 h-12 rounded-full border transition-all active:scale-95 disabled:opacity-40 ${
              muted
                ? 'border-red-500/40 bg-red-500/10 text-red-500'
                : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {muted ? (
              <MicOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Mic className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={endSession}
            aria-label="Encerrar conversa"
            className="inline-flex items-center gap-2 rounded-full bg-red-500 text-white hover:bg-red-600 px-5 h-12 text-sm font-medium transition-all active:scale-95"
          >
            <PhoneOff className="h-4 w-4" aria-hidden="true" />
            Encerrar
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-3">
          A conversa fica salva no histórico do chat ao encerrar.
        </p>
      </div>
    </div>
  );
}
