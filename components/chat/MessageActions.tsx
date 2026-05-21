'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

type Rating = 'up' | 'down';

type Props = {
  traceId: string;
  sessionId: string;
  initialRating?: Rating;
};

const COMMENT_MAX = 1000;

async function postFeedback(input: {
  sessionId: string;
  traceId: string;
  rating: Rating;
  comment?: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function MessageActions({ traceId, sessionId, initialRating }: Props) {
  const [rating, setRating] = useState<Rating | null>(initialRating ?? null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const click = async (next: Rating) => {
    const previous = rating;
    setRating(next);
    if (next === 'down') setShowComment(true);
    else setShowComment(false);

    const ok = await postFeedback({ sessionId, traceId, rating: next });
    if (!ok) {
      setRating(previous);
      setShowComment(previous === 'down');
      toast.error('Não foi possível registrar o feedback. Tente novamente.');
    }
  };

  const submitComment = async () => {
    if (!comment.trim()) {
      setShowComment(false);
      return;
    }
    setSubmitting(true);
    const ok = await postFeedback({
      sessionId,
      traceId,
      rating: 'down',
      comment: comment.slice(0, COMMENT_MAX),
    });
    setSubmitting(false);
    if (!ok) {
      toast.error('Não foi possível registrar o comentário. Tente novamente.');
      return;
    }
    setShowComment(false);
    setComment('');
  };

  return (
    <div className="mt-3 flex flex-col gap-2 pt-3 border-t border-border">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => click('up')}
          aria-pressed={rating === 'up'}
          aria-label="Resposta útil"
          title="Resposta boa"
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            rating === 'up'
              ? 'text-brand bg-brand/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <ThumbsUp
            className="h-3.5 w-3.5"
            fill={rating === 'up' ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
        <button
          type="button"
          onClick={() => click('down')}
          aria-pressed={rating === 'down'}
          aria-label="Resposta não útil"
          title="Resposta ruim"
          className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
            rating === 'down'
              ? 'text-brand bg-brand/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          <ThumbsDown
            className="h-3.5 w-3.5"
            fill={rating === 'down' ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
        </button>
      </div>
      {showComment ? (
        <div className="flex flex-col gap-2 max-w-md mt-1">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
            placeholder="O que faltou? (opcional, até 1000 caracteres)"
            className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-brand focus:bg-muted/60 transition-colors"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting}
              className="rounded-full bg-brand text-black px-4 h-8 text-xs font-medium hover:bg-brand/90 disabled:opacity-50 active:scale-95 transition-all duration-300"
            >
              {submitting ? 'Enviando…' : 'Enviar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowComment(false);
                setComment('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
