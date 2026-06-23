'use client';

import { Menu } from 'lucide-react';

type Props = {
  onOpenSidebar?: () => void;
};

// Mobile-only top bar. On desktop the sidebar is always present, so there's
// no top bar at all — feedback + theme controls live in the sidebar footer.
// On mobile this bar only carries the hamburger that opens the sidebar drawer.
export function Header({ onOpenSidebar }: Props) {
  return (
    <header className="dark md:hidden h-14 border-b border-border bg-[#0a0f1a]/95 text-foreground backdrop-blur-md flex items-center gap-2 px-4 shrink-0">
      {onOpenSidebar ? (
        <button
          type="button"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          onClick={onOpenSidebar}
          aria-label="Abrir conversas"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      <span className="text-sm font-semibold text-foreground">PROGPT</span>
    </header>
  );
}
