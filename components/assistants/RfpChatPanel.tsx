'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Send, Sparkles, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Sub-projeto 21 — Chat panel for refining a completed RFP.
//
// In-memory only (not persisted) — refinement is a working conversation,
// not part of the deliverable. If a future sub-projeto wants history,
// add a rfp_refinement_messages table keyed by run_id.

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Como reforçar os critérios técnicos sem afastar fornecedores?',
  'Esse prazo é realista para a categoria?',
  'Sugira cláusulas de SLA específicas para esse escopo.',
  'Que riscos esse RFP ainda não cobre?',
];

export function RfpChatPanel({ runId }: { runId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

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
                    : 'prose prose-sm dark:prose-invert max-w-none'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : m.content.length === 0 && streaming ? (
                  <p className="italic text-muted-foreground">Pensando…</p>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
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
