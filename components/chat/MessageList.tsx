'use client';

import { useEffect, useRef } from 'react';
import { Message } from './Message';
import { ThinkingDots } from './ThinkingDots';
import type { ChatMessage } from '@/lib/rag/types';
import type { AssistantToolType } from './AssistantToolCTA';

type Annotation = {
  traceId?: string;
  followups?: string[];
  supplierSearch?: { query: string };
  assistantCTA?: AssistantToolType;
  mode?: 'personal';
  webSearchUsed?: boolean;
};

type UIMessage = ChatMessage & {
  id?: string;
  annotations?: unknown[];
};

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
  sessionId?: string;
  initialRatings?: Map<string, 'up' | 'down'>;
  onPickFollowup?: (text: string) => void;
};

const STICK_THRESHOLD_PX = 80;

function pickTraceId(m: UIMessage): string | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => typeof a?.traceId === 'string');
  return found?.traceId;
}

function pickFollowups(m: UIMessage): string[] | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => Array.isArray(a?.followups));
  return found?.followups;
}

function pickSupplierSearchQuery(m: UIMessage): string | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find(
    (a) => typeof a?.supplierSearch?.query === 'string',
  );
  return found?.supplierSearch?.query;
}

function pickAssistantCTA(m: UIMessage): AssistantToolType | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => typeof a?.assistantCTA === 'string');
  return found?.assistantCTA;
}

// Modo Pessoal — lê primeiro da annotation (turno ao vivo, streaming);
// cai pro campo persistido `m.mode` (sessão recarregada do banco) quando não
// há annotation (histórico antigo não tem annotations no reload).
function pickMode(m: UIMessage): 'personal' | undefined {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => a?.mode === 'personal');
  return found?.mode ?? m.mode;
}

function pickWebSearchUsed(m: UIMessage): boolean {
  const ann = m.annotations as Annotation[] | undefined;
  const found = ann?.find((a) => typeof a?.webSearchUsed === 'boolean');
  return found?.webSearchUsed ?? false;
}

export function MessageList({
  messages,
  isLoading,
  sessionId,
  initialRatings,
  onPickFollowup,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < STICK_THRESHOLD_PX) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, isLoading]);

  const lastIdx = messages.length - 1;
  // Feedback de "processando" no gap entre enviar e o 1º token, enquanto ainda
  // não há bolha do assistant (a fase de condense/classify/retrieve/rerank).
  // Quando a bolha do assistant aparece, o indicador dela (Message) assume.
  const showThinking =
    isLoading && (messages.length === 0 || messages[lastIdx]?.role !== 'assistant');

  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      <ol className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((m, i) => {
          const traceId = pickTraceId(m);
          const initialRating = traceId ? initialRatings?.get(traceId) : undefined;
          const followups = pickFollowups(m);
          const supplierSearchQuery = pickSupplierSearchQuery(m);
          const assistantCTA = pickAssistantCTA(m);
          const mode = pickMode(m);
          const webSearchUsed = pickWebSearchUsed(m);
          const isLast = i === lastIdx;
          // Gráfico Rápido gera o PNG no lugar a partir do texto que o
          // usuário colou na mensagem imediatamente anterior — só faz
          // sentido oferecer isso quando essa mensagem existe e é do user.
          const previousUserContent =
            i > 0 && messages[i - 1]?.role === 'user' ? messages[i - 1]!.content : undefined;
          return (
            <Message
              key={m.id ?? i}
              role={m.role === 'assistant' ? 'assistant' : 'user'}
              content={m.content}
              isStreaming={isLoading && isLast && m.role === 'assistant'}
              traceId={traceId}
              sessionId={sessionId}
              initialRating={initialRating}
              followups={followups}
              supplierSearchQuery={supplierSearchQuery}
              assistantCTA={assistantCTA}
              mode={mode}
              webSearchUsed={webSearchUsed}
              previousUserContent={previousUserContent}
              isLast={isLast}
              onPickFollowup={onPickFollowup}
            />
          );
        })}
        {showThinking ? (
          <li className="flex justify-start" aria-live="polite">
            <div className="bg-card dark:bg-card border border-border rounded-2xl px-5 py-4">
              <ThinkingDots />
            </div>
          </li>
        ) : null}
      </ol>
    </div>
  );
}
