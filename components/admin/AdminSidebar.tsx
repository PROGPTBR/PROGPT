'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  FileText,
  Upload,
  MessageSquare,
  Tag,
  DollarSign,
  FileCode,
  TrendingUp,
  BookOpen,
  CreditCard,
  Activity,
  ArrowLeft,
} from 'lucide-react';

import { BrandLogo } from '@/components/brand/BrandLogo';

type SidebarItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  adminOnly?: boolean;
  profitabilityOnly?: boolean;
};

const ITEMS: SidebarItem[] = [
  {
    href: '/admin/monitor',
    label: 'Super Admin',
    Icon: Activity,
  },
  {
    href: '/admin/users',
    label: 'Usuários',
    Icon: Users,
  },
  {
    href: '/admin/articles',
    label: 'Artigos',
    Icon: FileText,
  },
  {
    href: '/admin/prompts',
    label: 'Prompts',
    Icon: BookOpen,
  },
  {
    href: '/admin/themes',
    label: 'Temas',
    Icon: Tag,
  },
  {
    href: '/admin/templates',
    label: 'Templates',
    Icon: FileCode,
  },
  {
    href: '/admin/ingest',
    label: 'Ingestão',
    Icon: Upload,
  },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    Icon: MessageSquare,
  },
  {
    href: '/admin/funnel',
    label: 'Funil',
    Icon: TrendingUp,
  },

  {
    href: '/admin/costs',
    label: 'Custos',
    Icon: DollarSign,
  },

  {
    href: '/admin/profitability',
    label: 'Rentabilidade',
    Icon: TrendingUp,
    adminOnly: true,
    profitabilityOnly: true,
  },

  {
    href: '/admin/billing',
    label: 'Faturamento',
    Icon: CreditCard,
    adminOnly: true,
  },
];

type AdminSidebarProps = {
  role?: 'admin' | 'gestor';
  canViewProfitability?: boolean;
};

export function AdminSidebar({
  role = 'admin',
  canViewProfitability = false,
}: AdminSidebarProps) {
  const pathname = usePathname();

  const items = ITEMS.filter((item) => {
    // Itens exclusivos de admin.
    if (item.adminOnly && role !== 'admin') {
      return false;
    }

    // Rentabilidade depende da autorização calculada no servidor.
    if (item.profitabilityOnly && !canViewProfitability) {
      return false;
    }

    return true;
  });

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/60 backdrop-blur-md flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-border">
        <Link
          href="/"
          className="inline-flex items-center mb-3"
        >
          <BrandLogo
            size="md"
            priority
          />
        </Link>

        <div className="text-[10px] font-medium uppercase tracking-wider text-brand">
          {role === 'gestor' ? 'Gestor' : 'Super Admin'}
        </div>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            pathname?.startsWith(href + '/');

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-brand/10 border border-brand/20 text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground border border-transparent'
              }`}
            >
              <Icon
                className="h-4 w-4"
                aria-hidden="true"
              />

              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <ArrowLeft
            className="h-4 w-4"
            aria-hidden="true"
          />

          <span>Voltar ao chat</span>
        </Link>
      </div>
    </aside>
  );
}