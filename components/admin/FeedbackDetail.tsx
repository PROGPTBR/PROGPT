'use client';

import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import type { FeedbackRow } from '@/lib/feedback';

type ChunkSource = {
  articleId?: string;
  articleTitle?: string;
  theme?: string;
  content?: string;
};

type Annotation = {
  traceId?: string;
  sources?: ChunkSource[];
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  annotations?: Annotation[];
};

type Props = {
  item: FeedbackRow;
  sessionMessages: Message[];
  onResolve: (resolved: boolean) => void;
};

function findContext(messages: Message[], traceId: string) {
  let assistantIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== 'assistant') continue;
    const hasMatch = m.annotations?.some((a) => a.traceId === traceId);
    if (hasMatch) {
      assistantIdx = i;
      break;
    }
  }
  if (assistantIdx === -1) {
    // Fallback: last assistant message in the session
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]!.role === 'assistant') {
        assistantIdx = i;
        break;
      }
    }
  }
  if (assistantIdx === -1) return { question: null, answer: null, sources: [] as ChunkSource[] };
  // The user message immediately preceding the assistant
  let userIdx = -1;
  for (let i = assistantIdx - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      userIdx = i;
      break;
    }
  }
  const assistant = messages[assistantIdx]!;
  const question = userIdx >= 0 ? messages[userIdx]!.content : null;
  const sources = assistant.annotations?.flatMap((a) => a.sources ?? []) ?? [];
  return { question, answer: assistant.content, sources };
}

export function FeedbackDetail({ item, sessionMessages, onResolve }: Props) {
  const { question, answer, sources } = useMemo(
    () => findContext(sessionMessages, item.trace_id),
    [sessionMessages, item.trace_id],
  );
  const resolved = item.resolved_at !== null;

  return (
    <div className="p-4 space-y-3 overflow-y-auto h-full text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {item.rating === 'up' ? '👍' : '👎'} ·{' '}
          {new Date(item.created_at).toLocaleString('pt-BR')}
        </span>
        <Button
          size="sm"
          variant={resolved ? 'outline' : 'default'}
          onClick={() => onResolve(!resolved)}
        >
          {resolved ? '↶ Desmarcar' : '✓ Marcar como resolvido'}
        </Button>
      </div>

      {question !== null && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Pergunta</h4>
          <p className="bg-muted/40 p-2 rounded border-l-2 border-border whitespace-pre-wrap">{question}</p>
        </div>
      )}

      {answer !== null && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Resposta</h4>
          <p className="bg-muted/40 p-2 rounded border-l-2 border-border whitespace-pre-wrap">{answer}</p>
        </div>
      )}

      {sources.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">
            Chunks usados ({sources.length})
          </h4>
          <ul className="space-y-1 text-xs">
            {sources.map((s, i) => (
              <li key={i} className="flex items-center gap-2 bg-muted/30 px-2 py-1 rounded">
                {s.theme && (
                  <span className="text-[10px] uppercase rounded bg-primary/10 text-primary px-1.5 py-0.5">
                    {s.theme}
                  </span>
                )}
                <span className="truncate">{s.articleTitle ?? s.articleId ?? '(sem título)'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.comment && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Comentário</h4>
          <blockquote className="bg-muted/40 p-2 rounded border-l-2 border-amber-500 italic whitespace-pre-wrap">
            {item.comment}
          </blockquote>
        </div>
      )}
    </div>
  );
}
