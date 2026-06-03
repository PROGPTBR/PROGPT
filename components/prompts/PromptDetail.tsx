'use client';

import { useRouter } from 'next/navigation';
import { Star, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { PublicPrompt } from '@/lib/prompts/types';
import { CHAT_PREFILL_KEY } from '@/lib/prompts/chat-prefill';

type Props = {
  prompt: PublicPrompt | null;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
};

export function PromptDetail({ prompt, isFavorite, onToggleFavorite }: Props) {
  const router = useRouter();

  if (!prompt) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt!.content);
      toast.success('Prompt copiado');
    } catch {
      toast.error('Falha ao copiar');
    }
  }

  function handleUseInChat() {
    try {
      sessionStorage.setItem(CHAT_PREFILL_KEY, prompt!.content);
    } catch {
      // sessionStorage indisponível — segue pro chat mesmo assim.
    }
    router.push('/chat');
  }

  return (
    <div className="flex flex-col h-full max-h-[85vh] min-h-0">
      <div className="p-5 border-b border-border pr-10">
        <span className="inline-block text-[10px] uppercase tracking-wider text-brand font-semibold mb-1">
          {prompt.category}
        </span>
        <h2 className="text-lg md:text-xl font-semibold leading-snug">{prompt.title}</h2>
        {prompt.summary && (
          <p className="text-sm text-muted-foreground mt-1.5">{prompt.summary}</p>
        )}

        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {prompt.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] rounded-full bg-muted border border-border px-2 py-0.5 text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" onClick={handleUseInChat}>
            <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Usar no chat
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Copiar
          </Button>
          <Button
            variant={isFavorite ? 'default' : 'outline'}
            size="sm"
            onClick={() => onToggleFavorite(prompt.id)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? 'Remover dos favoritos' : 'Favoritar'}
          >
            <Star
              className={`h-3.5 w-3.5 mr-1.5 ${isFavorite ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
            {isFavorite ? 'Favoritado' : 'Favoritar'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2.5">
          Dica: troque os trechos entre{' '}
          <code className="text-brand">[colchetes]</code> pelos seus dados antes de enviar.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground/90">
          {prompt.content}
        </pre>
      </div>
    </div>
  );
}
