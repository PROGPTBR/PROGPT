'use client';

import { type FormEvent } from 'react';
import { useChat, type Message as AIMessage } from 'ai/react';
import { toast } from 'sonner';
import type { ChatMessage } from '@/lib/rag/types';
import type { StoredSession } from '@/lib/chat-storage';
import { EmptyState } from './EmptyState';
import { MessageList } from './MessageList';
import { Composer, type ChatAttachment } from './Composer';

type Props = {
  session: StoredSession;
  initialRatings?: Map<string, 'up' | 'down'>;
  onMessagesChange: (messages: ChatMessage[]) => void;
  onTitleChange?: (title: string) => void;
};

function toChatMessages(messages: AIMessage[]): ChatMessage[] {
  return messages
    .filter((m): m is AIMessage & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}

type SessionTitleAnnotation = { sessionTitle?: string };

function pickSessionTitle(msg: AIMessage): string | undefined {
  const ann = msg.annotations as SessionTitleAnnotation[] | undefined;
  const hit = ann?.find((a) => typeof a?.sessionTitle === 'string');
  return hit?.sessionTitle;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Build the user-message text that gets POSTed to /api/chat. When the user
 * attached a file, prepend an <anexo>…</anexo> XML-style block with the
 * parsed text so the LLM has the context inline. The chat route stays
 * text-only — it doesn't need to know attachments exist.
 */
export function wrapWithAttachment(
  userText: string,
  attachment: ChatAttachment | undefined,
): string {
  const trimmed = userText.trim();
  if (!attachment) return trimmed;
  const sizeLabel = fmtSize(attachment.sizeBytes);
  const header = `<anexo arquivo="${attachment.filename}" tipo="${attachment.kind}" tamanho="${sizeLabel}">`;
  const footer = '</anexo>';
  // Default question when the user attached a file with no text.
  const question =
    trimmed.length > 0
      ? trimmed
      : `Analise o conteúdo do anexo "${attachment.filename}" e me explique os pontos principais.`;
  return `${header}\n${attachment.parsedText}\n${footer}\n\n${question}`;
}

export function ChatSession({
  session,
  initialRatings,
  onMessagesChange,
  onTitleChange,
}: Props) {
  const { messages, input, setInput, handleSubmit, isLoading, stop, append } = useChat({
    api: '/api/chat',
    id: session.id,
    body: { sessionId: session.id },
    initialMessages: session.messages.map((m, i) => ({
      id: `${session.id}-${i}`,
      role: m.role,
      content: m.content,
    })),
    onResponse: async (res) => {
      if (res.status === 429) {
        const body = await res.clone().json().catch(() => ({}));
        const secs: number = typeof body?.retry_after_secs === 'number' ? body.retry_after_secs : 60;
        const minutes = Math.max(1, Math.ceil(secs / 60));
        toast.error(`Limite de mensagens atingido. Tente novamente em ~${minutes} min.`);
      }
    },
    onError: (err) => {
      if (err.message.includes('rate_limited') || err.message.includes('429')) return;
      toast.error('Tivemos um problema. Tente enviar novamente.');
    },
    onFinish: (assistant) => {
      const next = toChatMessages([...messages, assistant]);
      onMessagesChange(next);
      const title = pickSessionTitle(assistant);
      if (title && onTitleChange) onTitleChange(title);
    },
  });

  const onPickFollowup = (text: string) => {
    if (isLoading) return;
    void append({ role: 'user', content: text });
  };

  const onComposerSubmit = (
    e?: FormEvent,
    attachment?: ChatAttachment,
  ) => {
    if (!attachment) {
      handleSubmit(e);
      return;
    }
    // Attachment present: bypass handleSubmit (which would send only
    // `input`) and route through append() with the wrapped content. The
    // textarea is cleared by setInput('').
    e?.preventDefault();
    const wrapped = wrapWithAttachment(input, attachment);
    setInput('');
    void append({ role: 'user', content: wrapped });
  };

  return (
    <>
      {messages.length === 0 ? (
        <EmptyState onPick={(text) => setInput(text)} />
      ) : (
        <MessageList
          messages={messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            annotations: m.annotations,
          }))}
          isLoading={isLoading}
          sessionId={session.id}
          initialRatings={initialRatings}
          onPickFollowup={onPickFollowup}
        />
      )}
      <Composer
        input={input}
        onChange={setInput}
        onSubmit={onComposerSubmit}
        isLoading={isLoading}
        onStop={stop}
      />
    </>
  );
}
