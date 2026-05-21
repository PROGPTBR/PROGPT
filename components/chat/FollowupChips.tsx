'use client';

type Props = {
  followups: string[];
  onPick: (text: string) => void;
  disabled?: boolean;
};

export function FollowupChips({ followups, onPick, disabled }: Props) {
  if (disabled) return null;
  if (!followups || followups.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border">
      {followups.map((text, i) => (
        <button
          key={`${i}-${text}`}
          type="button"
          onClick={() => onPick(text)}
          aria-label={`Follow-up sugerido: ${text}`}
          className="rounded-full border border-border bg-muted/40 hover:bg-brand/10 hover:border-brand/40 hover:text-brand px-3 py-1.5 text-xs text-foreground/80 transition-all duration-300 active:scale-95"
        >
          {text}
        </button>
      ))}
    </div>
  );
}
