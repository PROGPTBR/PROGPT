'use client';

import Link from 'next/link';
import {
  BarChart3,
  DollarSign,
  Factory,
  FileText,
  Grid2x2,
  Layers,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';

// Sub-projeto — Launcher horizontal dos assistentes.
//
// Feedback de usuário: "os assistentes são o grande destaque" — antes
// ficavam atrás do link "Assistentes →" na sidebar (2 clicks). Agora
// uma row de chips fica sempre visível acima do Composer (tanto no
// EmptyState quanto durante uma conversa), exibindo todos os 8 numa
// hierarquia de Strategic Sourcing. Mobile: scroll horizontal.

type LauncherEntry = {
  href: string;
  label: string;
  Icon: LucideIcon;
};

const ENTRIES: LauncherEntry[] = [
  { href: '/assistants/abc', label: 'ABC', Icon: BarChart3 },
  { href: '/assistants/porter', label: 'Porter', Icon: Layers },
  { href: '/assistants/suppliers', label: 'Fornecedores', Icon: Factory },
  { href: '/assistants/kraljic', label: 'Kraljic', Icon: Grid2x2 },
  { href: '/assistants/rfp', label: 'RFP', Icon: FileText },
  { href: '/assistants/negotiation', label: 'Negociação', Icon: MessageCircle },
  { href: '/assistants/financial', label: 'Financeiro', Icon: DollarSign },
];

type Props = {
  // 'hero' = empty state (chips brand-accent maior); 'compact' = acima do
  // Composer durante conversa (chips menores, menos chamativos).
  variant?: 'hero' | 'compact';
};

export function AssistantLauncher({ variant = 'compact' }: Props) {
  const isHero = variant === 'hero';

  return (
    <nav
      aria-label="Atalhos para assistentes"
      className={
        isHero
          ? 'w-full'
          : 'w-full max-w-3xl mx-auto px-2 pb-2'
      }
    >
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ENTRIES.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={
              isHero
                ? 'group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-transparent hover:bg-brand/15 hover:border-brand/60 px-7 h-10 text-sm font-medium text-brand whitespace-nowrap transition-all duration-300 active:scale-95 flex-shrink-0 text-white'
                : 'group inline-flex items-center gap-1.5 rounded-full border border-border bg-card hover:bg-accent hover:border-brand/40 px-3 h-8 text-sm font-medium text-foreground/80 hover:text-foreground whitespace-nowrap transition-all duration-300 active:scale-95 flex-shrink-0'
            }
          >
            <Icon className="h-4 w-4 text-brand" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
