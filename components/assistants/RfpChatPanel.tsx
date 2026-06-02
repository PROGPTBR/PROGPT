'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Send, Sparkles, User as UserIcon, FilePlus2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Painel de refino de um run concluído (compartilhado por todos os tipos).
//
// Item 6 do roadmap — o refine-chat agora É persistido (reverte a decisão
// in-memory do sub-projeto 21): grava por turno no onFinish da rota
// /runs/[id]/chat (coluna refine_messages) e hidrata ao montar via GET
// /runs/[id]/refine-messages. Sobrevive a reload. (O badge "Aplicado" não é
// persistido — só o texto da conversa.)

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  applied?: boolean;
};

const SUGGESTIONS = [
  'Como reforçar os critérios técnicos sem afastar fornecedores?',
  'Esse prazo é realista para a categoria?',
  'Sugira cláusulas de SLA específicas para esse escopo.',
  'Que riscos esse RFP ainda não cobre?',
];

type Props = {
  runId: string;
  onRfpUpdated?: (newMarkdown: string) => void;
};

export function RfpChatPanel({ runId, onRfpUpdated }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Item 6 — hidrata o histórico persistido do refine-chat ao abrir o run.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/assistants/runs/${runId}/refine-messages`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages?: Msg[] };
        if (!cancelled && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map((m) => ({ role: m.role, content: m.content })));
        }
      } catch {
        // não-fatal — começa vazio
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  async function applySuggestion(idx: number) {
    const msg = messages[idx];
    if (!msg || msg.role !== 'assistant' || !msg.content.trim()) return;
    setApplyingIdx(idx);
    try {
      const res = await fetch(`/api/assistants/runs/${runId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestion: msg.content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { output_md?: string };
      if (data.output_md && onRfpUpdated) onRfpUpdated(data.output_md);
      setMessages((prev) =>
        prev.map((m, i) => (i === idx ? { ...m, applied: true } : m)),
      );
      toast.success('Sugestão aplicada à RFP');
    } catch (err) {
      toast.error('Falha ao aplicar', { description: String(err) });
    } finally {
      setApplyingIdx(null);
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const next: Msg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setStreaming(true);

    // Optimistic assistant placeholder we append into as the stream arrives.
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(`/api/assistants/runs/${runId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
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
            const text = JSON.parse(line.slice(colon + 1)) as string;
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last && last.role === 'assistant') {
                copy[copy.length - 1] = { ...last, content: last.content + text };
              }
              return copy;
            });
          } catch {
            // tolerant
          }
        }
      }
    } catch (err) {
      toast.error('Falha no refinamento', { description: String(err) });
      // Roll back the empty assistant placeholder so user sees clean state.
      setMessages((prev) => prev.filter((m, i) => !(i === prev.length - 1 && m.content === '')));
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-primary" />
        Refinar com o especialista
        <span className="text-xs text-muted-foreground font-normal ml-1">
          — perguntas usando este RFP + a base de conhecimento
        </span>
      </div>

      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Sugestões para começar:</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={streaming}
                className="text-xs rounded-full px-3 py-1 border border-border bg-background hover:bg-accent disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className="flex gap-2 text-sm">
              <div className="flex-shrink-0 mt-0.5">
                {m.role === 'user' ? (
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </div>
              <div
                className={`flex-1 ${
                  m.role === 'user'
                    ? 'text-foreground'
                    : 'prose prose-sm prose-invert max-w-none'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : m.content.length === 0 && streaming ? (
                  <p className="italic text-muted-foreground">Pensando…</p>
                ) : (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    {/* Apply-to-RFP — only on completed assistant messages */}
                    {m.content.length > 0 && !streaming && (
                      <div className="not-prose mt-2">
                        {m.applied ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Aplicado à RFP
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={applyingIdx === i}
                            onClick={() => applySuggestion(i)}
                          >
                            <FilePlus2 className="h-3.5 w-3.5 mr-1" />
                            {applyingIdx === i ? 'Aplicando…' : 'Aplicar à RFP'}
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pergunte sobre o RFP gerado…"
          disabled={streaming}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          maxLength={4000}
        />
        <Button type="submit" size="sm" disabled={streaming || !input.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
