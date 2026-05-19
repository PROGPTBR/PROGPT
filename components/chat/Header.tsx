'use client';

import { Menu, MessageSquareText } from 'lucide-react';

// TODO: replace with company-owned address once branding is decided.
const FEEDBACK_MAILTO =
  'mailto:rgoalves@gmail.com?subject=ProcurementGPT%20feedback';

type Props = {
  onOpenSidebar?: () => void;
};

export function Header({ onOpenSidebar }: Props) {
  return (
    <header className="h-14 border-b border-white/5 bg-black/40 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        {onOpenSidebar ? (
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            onClick={onOpenSidebar}
            aria-label="Abrir conversas"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        <span className="text-sm font-semibold md:hidden">
          ProcurementGPT
        </span>
      </div>
      <div className="flex items-center gap-1">
        <a
          href={FEEDBACK_MAILTO}
          aria-label="Enviar feedback"
          title="Enviar feedback geral"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:text-brand hover:bg-brand/5 transition-colors"
        >
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
