'use client';

import { useEffect, useRef } from 'react';
import { Message } from './Message';
import type { ChatMessage } from '@/lib/rag/types';

type UIMessage = ChatMessage & { id?: string };

type Props = {
  messages: UIMessage[];
  isLoading: boolean;
};

const STICK_THRESHOLD_PX = 80;

export function MessageList({ messages, isLoading }: Props) {
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

  return (
    <div ref={ref} className="flex-1 overflow-y-auto">
      <ol className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {messages.map((m, i) => (
          <Message
            key={m.id ?? i}
            role={m.role === 'assistant' ? 'assistant' : 'user'}
            content={m.content}
            isStreaming={isLoading && i === lastIdx && m.role === 'assistant'}
          />
        ))}
      </ol>
    </div>
  );
}
