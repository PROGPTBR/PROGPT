'use client';

// Indicador de "gerando resposta" — três pontinhos animados (typing indicator).
// Usado (a) no gap antes do 1º token, quando ainda não há bolha do assistant
// (MessageList), e (b) dentro da bolha do assistant enquanto o conteúdo está
// vazio (Message). Assim o usuário sempre tem feedback de que está processando.
export function ThinkingDots({ label = 'Gerando resposta' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 py-1"
      role="status"
      aria-label={label}
      data-thinking-dots
    >
      <span className="h-2 w-2 rounded-full bg-brand/70 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-brand/70 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-brand/70 animate-bounce" />
      <span className="sr-only">{label}…</span>
    </span>
  );
}
