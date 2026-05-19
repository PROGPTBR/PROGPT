'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageActions } from './MessageActions';
import { FollowupChips } from './FollowupChips';

type Props = {
  role: 'user' | 'assistant';
  content: string;
  isStreaming: boolean;
  traceId?: string;
  sessionId?: string;
  initialRating?: 'up' | 'down';
  followups?: string[];
  isLast?: boolean;
  onPickFollowup?: (text: string) => void;
};

export function Message({
  role,
  content,
  isStreaming,
  traceId,
  sessionId,
  initialRating,
  followups,
  isLast,
  onPickFollowup,
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
  return (
    <li className="flex justify-start">
      <div className="bg-[#141414] border border-white/5 max-w-[85%] rounded-2xl px-5 py-4">
        <div className="prose prose-sm prose-invert max-w-none prose-headings:text-white prose-strong:text-white prose-a:text-brand prose-code:text-brand prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-l-brand prose-blockquote:text-gray-300 prose-li:text-gray-200 prose-p:text-gray-200">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
        {isStreaming ? (
          <span
            data-streaming-dot
            className="inline-block ml-1 h-2 w-2 rounded-full bg-brand animate-pulse"
            aria-label="Gerando"
          />
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
