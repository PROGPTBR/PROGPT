'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Briefcase,
  Download,
  Eye,
  Flag,
  Loader2,
  MessageCircle,
  PieChart,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { handlePaywallResponse } from '@/lib/billing/handle-paywall';
import { MicRecorderButton } from '@/components/chat/MicRecorderButton';
import {
  KRALJIC_QUADRANT_LABELS,
  NEGOTIATION_OBJECTIVE_LABELS,
  type NegotiationStrategyParams,
  type NegotiationStrategyResult,
} from '@/lib/assistants/types';

export type Msg = { role: 'user' | 'assistant'; content: string };

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setInput('');
    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setStreaming(true);
    // Acrescenta um placeholder do assistant pra streaming aparecer no UI
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(`/api/assistants/runs/${runId}/negotiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as {
          retry_after_secs?: number;
        };
        toast.error(
          `Limite atingido. Tente em ${data.retry_after_secs ?? 60}s.`,
        );
        setMessages(next); // rollback do placeholder
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
        setMessages(next);
        return;
      }

      const reader = res.body.getReader();
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
          const type = line.slice(0, colon);
          if (type !== '0') continue;
          const json = line.slice(colon + 1);
          try {
            const piece = JSON.parse(json) as string;
            acc += piece;
            setMessages((prev) => {
              const copy = prev.slice();
              copy[copy.length - 1] = { role: 'assistant', content: acc };
              return copy;
            });
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Erro', { description: msg });
      setMessages(next);
    } finally {
      setStreaming(false);
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
            disabled={isClosing || messages.length < 3}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 h-8 px-3 text-xs font-medium text-red-700 dark:text-red-400 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            title={messages.length < 3 ? 'Negocie pelo menos 1 turno antes' : ''}
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
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-brand text-black font-medium'
                    : 'bg-muted text-foreground/90'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1">
                    <ReactMarkdown>{m.content || ' '}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
                {m.role === 'assistant' &&
                  streaming &&
                  i === messages.length - 1 &&
                  !m.content && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" aria-hidden="true" />
                      Digitando…
                    </span>
                  )}
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-5 py-3 border-t border-border flex gap-2 items-end"
        >
          <MicRecorderButton
            size="lg"
            onTranscript={handleTranscript}
            disabled={streaming}
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
            placeholder="Digite sua mensagem…"
            rows={1}
            className="flex-1 resize-none max-h-32 overflow-y-auto rounded-xl bg-muted/40 border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
            disabled={streaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || streaming}
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
