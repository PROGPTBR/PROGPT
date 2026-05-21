'use client';

import { useEffect, useState } from 'react';
import { Menu, MessageSquareText, Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';

// TODO: replace with company-owned address once branding is decided.
const FEEDBACK_MAILTO =
  'mailto:rgoalves@gmail.com?subject=ProcurementGPT%20feedback';

type Props = {
  onOpenSidebar?: () => void;
};

export function Header({ onOpenSidebar }: Props) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const cycleTheme = () => {
    // Cycle: light → dark → system → light …
    const next =
      theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(next);
  };

  const ThemeIcon = !mounted
    ? Sun
    : theme === 'dark'
      ? Moon
      : theme === 'system'
        ? Monitor
        : Sun;
  const themeLabel = !mounted
    ? 'Tema'
    : theme === 'dark'
      ? 'Tema: escuro (clique para alternar)'
      : theme === 'system'
        ? 'Tema: sistema (clique para alternar)'
        : 'Tema: claro (clique para alternar)';

  return (
    <header className="h-14 border-b border-border bg-card/40 dark:bg-black/40 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        {onOpenSidebar ? (
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={onOpenSidebar}
            aria-label="Abrir conversas"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <span className="text-sm font-semibold md:hidden text-foreground">
          ProcurementGPT
        </span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={FEEDBACK_MAILTO}
          aria-label="Enviar feedback"
          title="Enviar feedback geral"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-brand hover:bg-brand/5 transition-colors"
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={themeLabel}
          title={themeLabel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <ThemeIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
