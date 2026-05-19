'use client';

import { type FormEvent, type KeyboardEvent, useCallback } from 'react';
import { Send, StopCircle } from 'lucide-react';

type Props = {
  input: string;
  onChange: (value: string) => void;
  onSubmit: (e?: FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
};

export function Composer({
  input,
  onChange,
  onSubmit,
  isLoading,
  onStop,
}: Props) {
  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!input.trim() || isLoading) return;
      onSubmit(e);
    },
    [input, isLoading, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  return (
    <form
      onSubmit={submit}
      className="border-t border-white/5 bg-[#0d0d0d] p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
    >
      <div className="flex gap-2 items-end max-w-3xl mx-auto">
        <textarea
          value={input}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo sobre teorias de procurement…"
          rows={1}
          className="flex-1 resize-none max-h-32 overflow-y-auto rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-brand focus:bg-white/10 transition-colors"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar geração"
            title="Parar"
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 w-11 h-11 transition-all duration-300 active:scale-95"
          >
            <StopCircle className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            aria-label="Enviar"
            title="Enviar"
            disabled={!input.trim()}
            className="inline-flex items-center justify-center rounded-full bg-brand text-black hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed w-11 h-11 transition-all duration-300 active:scale-95"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </form>
  );
}
