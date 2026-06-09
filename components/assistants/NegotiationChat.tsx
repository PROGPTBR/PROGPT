'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Briefcase,
  Download,
  Eye,
  Flag,
  GraduationCap,
  Loader2,
  MessageCircle,
  Paperclip,
  PieChart,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';
import { MicRecorderButton } from '@/components/chat/MicRecorderButton';
import { wrapWithAttachment } from '@/components/chat/ChatSession';
import type { ChatAttachment } from '@/components/chat/Composer';
import {
  KRALJIC_QUADRANT_LABELS,
  NEGOTIATION_OBJECTIVE_LABELS,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
} from '@/lib/assistants/types';

// Sub-projeto 34 — modo voz + coach inline + anexos no simulador.
// `kind: 'coach'` marca os apartes com o coach (timeout tático): essas
// mensagens NUNCA vão no payload do /negotiate (o fornecedor não vê o
// coaching) nem entram no transcript persistido que o /close pontua.
export type Msg = {
  role: 'user' | 'assistant';
  content: string;
  kind?: 'coach';
};

const VOICE_PREF_KEY = 'progpt_negotiation_voice_v1';
const TTS_INPUT_CAP = 4000;

type Props = {
  runId: string;
  params: NegotiationStrategyParams;
  strategy: NegotiationStrategyResult | null;
  /** Opener gerado pelo /setup. Ignorado quando `initialMessages` é passado. */
  initialOpener?: string;
  /** Quando presente, hidrata o chat com histórico salvo (modo "Continuar"). */
  initialMessages?: Msg[];
  onViewStrategy: () => void;
  onClose: () => void;
  isClosing: boolean;
};

export function NegotiationChat({
  runId,
  params,
  strategy,
  initialOpener,
  initialMessages,
  onViewStrategy,
  onClose,
  isClosing,
}: Props) {
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (initialMessages && initialMessages.length > 0) return initialMessages;
    if (initialOpener) return [{ role: 'assistant', content: initialOpener }];
    return [];
  });
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [coachStreaming, setCoachStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Voz do fornecedor (TTS) ───────────────────────────────────────────────
  const [voiceOn, setVoiceOn] = useState(true);
  useEffect(() => {
    try {
      if (localStorage.getItem(VOICE_PREF_KEY) === '0') setVoiceOn(false);
    } catch {
      /* localStorage indisponível */
    }
  }, []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [loadingSpeechIdx, setLoadingSpeechIdx] = useState<number | null>(null);

  const stopAudio = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingIdx(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  function toggleVoice() {
    setVoiceOn((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      if (!next) stopAudio();
      return next;
    });
  }

  const speak = useCallback(
    async (text: string, idx: number) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      stopAudio();
      setLoadingSpeechIdx(idx);
      try {
        const res = await fetch(`/api/assistants/runs/${runId}/speak`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed.slice(0, TTS_INPUT_CAP) }),
        });
        if (!res.ok) return; // não-fatal — degrada pra texto
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setSpeakingIdx((cur) => (cur === idx ? null : cur));
        };
        setSpeakingIdx(idx);
        await audio.play();
      } catch {
        // Autoplay bloqueado ou rede — o botão ▶ da bolha é o fallback.
        setSpeakingIdx(null);
      } finally {
        setLoadingSpeechIdx((cur) => (cur === idx ? null : cur));
      }
    },
    [runId, stopAudio],
  );

  // Fala o opener (1ª fala do fornecedor) numa sessão nova. Se o browser
  // bloquear autoplay, falha silenciosa — o ▶ na bolha resolve.
  const openerSpokenRef = useRef(false);
  useEffect(() => {
    if (openerSpokenRef.current) return;
    if (!voiceOn || !initialOpener) return;
    if (initialMessages && initialMessages.length > 0) return;
    openerSpokenRef.current = true;
    void speak(initialOpener, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceOn]);

  // ── Anexos (contrato/proposta) — reusa o parse genérico do chat ───────────
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/chat/attachments', {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as
        | (ChatAttachment & { error?: undefined })
        | { error: string; message?: string };
      if (!res.ok || 'error' in data) {
        toast.error('Falha ao processar arquivo', {
          description:
            'message' in data && typeof data.message === 'string'
              ? data.message
              : 'Use PDF, DOCX ou XLSX de até 10 MB.',
        });
        return;
      }
      setAttachment(data as ChatAttachment);
      if ((data as ChatAttachment).truncated) {
        toast.info('Documento grande — apenas o início foi anexado.');
      }
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming, coachStreaming]);

  // Mensagens da NEGOCIAÇÃO (sem os apartes do coach) — é o que o fornecedor
  // vê, o que o transcript persiste e o que conta pro gate do score.
  const negotiationMessages = messages.filter((m) => m.kind !== 'coach');

  /** Lê um data-stream (SSE do Vercel AI SDK) atualizando a última bolha. */
  async function readStreamInto(res: Response) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let acc = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line) continue;
        const colon = line.indexOf(':');
        if (colon < 0) continue;
        if (line.slice(0, colon) !== '0') continue;
        try {
          acc += JSON.parse(line.slice(colon + 1)) as string;
          setMessages((prev) => {
            const copy = prev.slice();
            const last = copy[copy.length - 1]!;
            copy[copy.length - 1] = { ...last, content: acc };
            return copy;
          });
        } catch {
          /* ignore */
        }
      }
    }
    return acc;
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if ((!trimmed && !attachment) || streaming || coachStreaming) return;
    setInput('');
    const content = wrapWithAttachment(trimmed, attachment ?? undefined);
    setAttachment(null);
    const nextAll: Msg[] = [...messages, { role: 'user', content }];
    const payload = nextAll
      .filter((m) => m.kind !== 'coach')
      .map((m) => ({ role: m.role, content: m.content }));
    const assistantIdx = nextAll.length;
    setMessages([...nextAll, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const res = await fetch(`/api/assistants/runs/${runId}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        toast.error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
        setMessages(nextAll); // rollback do placeholder
        return;
      }
      // Cap de turnos free atingido → toast "Ver planos". Remove o turno
      // rejeitado (free não consegue retomar; precisa do Pro).
      if (handlePaywallResponse(res, 'negotiation')) {
        setMessages(messages);
        return;
      }
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error('Falha ao gerar resposta', {
          description: data.error ?? `status ${res.status}`,
        });
        setMessages(nextAll);
        return;
      }

      const finalText = await readStreamInto(res);
      if (voiceOn && finalText.trim()) {
        void speak(finalText, assistantIdx);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setMessages(nextAll);
    } finally {
      setStreaming(false);
    }
  }

  // ── Coach inline (timeout tático) ─────────────────────────────────────────
  // Usa o texto do composer como pergunta opcional. O conselho streama numa
  // bolha 'coach' distinta e nunca contamina o fornecedor nem o score.
  async function askCoach() {
    if (streaming || coachStreaming) return;
    const question = input.trim() || undefined;
    setInput('');
    const payload = negotiationMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const withQuestion: Msg[] = question
      ? [...messages, { role: 'user', kind: 'coach', content: question }]
      : messages;
    setMessages([...withQuestion, { role: 'assistant', kind: 'coach', content: '' }]);
    setCoachStreaming(true);

    try {
      const res = await fetch(`/api/assistants/runs/${runId}/advise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload, question }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        toast.error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
        setMessages(withQuestion);
        return;
      }
      if (!res.ok || !res.body) {
        toast.error('Falha ao consultar o coach', {
          description: `status ${res.status}`,
        });
        setMessages(withQuestion);
        return;
      }
      await readStreamInto(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setMessages(withQuestion);
    } finally {
      setCoachStreaming(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function handleTranscript(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const current = input.trim();
    setInput(current ? `${current} ${trimmed}` : trimmed);
  }

  function handleDownloadTranscript() {
    window.location.href = `/api/assistants/runs/${runId}/docx`;
  }

  const busy = streaming || coachStreaming;

  return (
    <div className="space-y-4">
      {/* Header com Resumo da Estratégia */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand">
          <PieChart className="h-3.5 w-3.5" aria-hidden="true" />
          Resumo da Estratégia
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fornecedor
            </div>
            <div className="font-semibold text-foreground">
              {params.supplierName}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Objetivo
            </div>
            <div className="font-semibold text-foreground">
              {params.strategicObjective
                ? NEGOTIATION_OBJECTIVE_LABELS[params.strategicObjective]
                : params.category}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Quadrante Kraljic
            </div>
            <div className="font-semibold text-foreground">
              {strategy
                ? strategy.kraljic.label
                : params.kraljicQuadrant
                  ? KRALJIC_QUADRANT_LABELS[params.kraljicQuadrant]
                  : '—'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onViewStrategy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-accent h-8 px-3 text-xs font-medium text-foreground transition-colors active:scale-95"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Visualizar Estratégia Completa
          </button>
          <button
            type="button"
            onClick={handleDownloadTranscript}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-accent h-8 px-3 text-xs font-medium text-foreground transition-colors active:scale-95"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Gerar Transcrição
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing || negotiationMessages.length < 3}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 h-8 px-3 text-xs font-medium text-red-700 dark:text-red-400 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title={
              negotiationMessages.length < 3
                ? 'Negocie pelo menos 1 turno antes'
                : ''
            }
          >
            {isClosing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Encerrar e gerar score
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="rounded-2xl border border-border bg-card flex flex-col h-[60vh] min-h-[400px]">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-brand" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">
            Negociação em Andamento
          </h2>
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? 'Desativar voz do fornecedor' : 'Ativar voz do fornecedor'}
            title={voiceOn ? 'Voz ligada — o fornecedor fala as respostas' : 'Voz desligada'}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full border h-7 px-2.5 text-[11px] font-medium transition-colors active:scale-95 ${
              voiceOn
                ? 'border-brand/40 bg-brand/10 text-brand'
                : 'border-border bg-background text-muted-foreground hover:text-foreground'
            }`}
          >
            {voiceOn ? (
              <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {voiceOn ? 'Voz ligada' : 'Voz desligada'}
          </button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => {
            const isCoach = m.kind === 'coach';
            return (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    isCoach
                      ? m.role === 'user'
                        ? 'bg-violet-500/10 border border-violet-500/30 text-foreground/90'
                        : 'bg-violet-500/5 border border-violet-500/30 text-foreground/90'
                      : m.role === 'user'
                        ? 'bg-brand text-black font-medium'
                        : 'bg-muted text-foreground/90'
                  }`}
                >
                  {isCoach && (
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      <GraduationCap className="h-3 w-3" aria-hidden="true" />
                      {m.role === 'user' ? 'Pergunta ao coach' : 'Coach'}
                    </div>
                  )}
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                      <ReactMarkdown>{m.content || ' '}</ReactMarkdown>
                    </div>
                  ) : (
                    m.content
                  )}
                  {m.role === 'assistant' &&
                    busy &&
                    i === messages.length - 1 &&
                    !m.content && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {isCoach ? (
                          <GraduationCap className="h-3 w-3" aria-hidden="true" />
                        ) : (
                          <Briefcase className="h-3 w-3" aria-hidden="true" />
                        )}
                        {isCoach ? 'Analisando…' : 'Digitando…'}
                      </span>
                    )}
                  {m.role === 'assistant' && !isCoach && m.content && (
                    <button
                      type="button"
                      onClick={() =>
                        speakingIdx === i ? stopAudio() : void speak(m.content, i)
                      }
                      disabled={loadingSpeechIdx === i}
                      aria-label={
                        speakingIdx === i ? 'Parar áudio' : 'Ouvir esta fala'
                      }
                      title={speakingIdx === i ? 'Parar' : 'Ouvir'}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-brand transition-colors disabled:opacity-50"
                    >
                      {loadingSpeechIdx === i ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : speakingIdx === i ? (
                        <VolumeX className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <Volume2 className="h-3 w-3" aria-hidden="true" />
                      )}
                      {loadingSpeechIdx === i
                        ? 'gerando áudio…'
                        : speakingIdx === i
                          ? 'parar'
                          : 'ouvir'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {attachment && (
          <div className="px-5 pt-2 flex">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand/10 border border-brand/30 px-3 h-8 text-xs">
              <Paperclip className="h-3 w-3 text-brand flex-shrink-0" aria-hidden="true" />
              <span
                className="text-foreground/80 truncate max-w-[240px]"
                title={attachment.filename}
              >
                {attachment.filename}
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                aria-label="Remover anexo"
                className="text-muted-foreground hover:text-red-500 transition-colors"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
          </div>
        )}
        {uploading && !attachment && (
          <div className="px-5 pt-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted border border-border px-3 h-8 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Processando documento…
            </span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="px-5 py-3 border-t border-border flex gap-2 items-end"
        >
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
            disabled={uploading || busy}
            aria-label="Anexar contrato ou proposta"
            title="Anexar contrato/proposta (PDF, DOCX, XLSX) — o fornecedor simulado passa a conhecer o documento"
            className="inline-flex items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-accent w-11 h-11 transition-all duration-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
          </button>
          <MicRecorderButton
            size="lg"
            onTranscript={handleTranscript}
            disabled={busy}
          />
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            placeholder="Fale ou digite seu lance… (anexe contrato/proposta no clipe)"
            rows={1}
            className="flex-1 resize-none max-h-32 overflow-y-auto rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
            disabled={busy}
          />
          <button
            type="button"
            onClick={() => void askCoach()}
            disabled={busy || negotiationMessages.length === 0}
            aria-label="Pedir conselho ao coach"
            title="Pedir conselho ao coach — pausa tática (o fornecedor não vê). Texto digitado vira sua pergunta."
            className="inline-flex items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 disabled:opacity-40 disabled:cursor-not-allowed w-11 h-11 transition-all duration-300 active:scale-95 flex-shrink-0"
          >
            {coachStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="submit"
            disabled={(!input.trim() && !attachment) || busy}
            aria-label="Enviar"
            className="inline-flex items-center justify-center rounded-full bg-brand text-black hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed w-11 h-11 transition-all duration-300 active:scale-95 flex-shrink-0"
          >
            {streaming ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
