'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Globe, Search } from 'lucide-react';
import { MessageActions } from './MessageActions';
import { FollowupChips } from './FollowupChips';
import { SupplierSearchCTA } from './SupplierSearchCTA';
import { InlineQuickChart } from './InlineQuickChart';
import { ThinkingDots } from './ThinkingDots';
import {
  AssistantToolCTA,
  detectAssistantToolCTA,
  stripAssistantPaths,
  type AssistantToolType,
} from './AssistantToolCTA';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  traceId?: string;
  sessionId?: string;
  initialRating?: 'up' | 'down';
  followups?: string[];
  supplierSearchQuery?: string;
  assistantCTA?: AssistantToolType;
  previousUserContent?: string;
  isLast?: boolean;
  onPickFollowup?: (text: string) => void;
  /** Assistente Pessoal — modo livre, sem restrição de domínio. */
  mode?: 'personal';
  webSearchUsed?: boolean;
};

export function Message({
  role,
  content,
  isStreaming,
  traceId,
  sessionId,
  initialRating,
  followups,
  supplierSearchQuery,
  assistantCTA,
  previousUserContent,
  isLast,
  onPickFollowup,
  mode,
  webSearchUsed,
}: Props) {
  if (role === 'user') {
    return (
      <li className="flex justify-end">
        <div className="bg-brand text-black max-w-[75%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap break-words text-sm font-medium">
          {content}
        </div>
      </li>
    );
  }
  // The big CTA card prefers the backend annotation but falls back to
  // detecting the canonical path in the content itself. The annotation is
  // ephemeral (SSE-only, skipped if finishReason !== 'stop', gone on reload),
  // so deriving from content guarantees the card shows whenever the answer
  // mentions a tool — including reloaded sessions.
  const cta: AssistantToolType | undefined =
    assistantCTA ?? detectAssistantToolCTA(content) ?? undefined;

  return (
    <li className="flex justify-start">
      <div className="bg-card dark:bg-card border border-border max-w-[85%] rounded-2xl px-5 py-4">
        {mode === 'personal' ? (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
              <Globe className="h-3 w-3" aria-hidden="true" />
              Modo Pessoal
            </span>
            {webSearchUsed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                <Search className="h-3 w-3" aria-hidden="true" />
                Busca ao vivo
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-a:text-brand prose-code:text-brand prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-brand prose-headings:text-foreground prose-strong:text-foreground prose-p:text-foreground/90 prose-li:text-foreground/90">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {stripAssistantPaths(content)}
          </ReactMarkdown>
        </div>
        {isStreaming ? (
          content.trim() ? (
            <span
              data-streaming-dot
              className="inline-block ml-1 h-2 w-2 rounded-full bg-brand animate-pulse"
              aria-label="Gerando"
            />
          ) : (
            // Bolha do assistant já existe mas o 1º token ainda não chegou —
            // mostra os pontinhos em vez de uma bolha vazia.
            <ThinkingDots />
          )
        ) : null}
        {!isStreaming && supplierSearchQuery ? (
          <SupplierSearchCTA query={supplierSearchQuery} />
        ) : null}
        {!isStreaming && cta === 'grafico_rapido' && !supplierSearchQuery ? (
          <InlineQuickChart sourceText={previousUserContent ?? ''} />
        ) : null}
        {!isStreaming && cta && cta !== 'grafico_rapido' && !supplierSearchQuery ? (
          <AssistantToolCTA type={cta} />
        ) : null}
        {!isStreaming && traceId && sessionId ? (
          <MessageActions
            traceId={traceId}
            sessionId={sessionId}
            initialRating={initialRating}
          />
        ) : null}
        {!isStreaming &&
        isLast &&
        followups &&
        followups.length > 0 &&
        onPickFollowup ? (
          <FollowupChips followups={followups} onPick={onPickFollowup} />
        ) : null}
      </div>
    </li>
  );
}
