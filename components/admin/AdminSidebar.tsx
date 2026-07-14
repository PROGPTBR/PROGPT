'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

// adminOnly: só admin vê (Gestor é "quase-admin", mas não mexe em faturamento).
const ITEMS = [
  { href: '/admin/monitor', label: 'Monitoramento', Icon: Activity },
  { href: '/admin/users', label: 'Usuários', Icon: Users },
  { href: '/admin/articles', label: 'Artigos', Icon: FileText },
  { href: '/admin/prompts', label: 'Prompts', Icon: BookOpen },
  { href: '/admin/themes', label: 'Temas', Icon: Tag },
  { href: '/admin/templates', label: 'Templates', Icon: FileCode },
  { href: '/admin/ingest', label: 'Ingestão', Icon: Upload },
  { href: '/admin/feedback', label: 'Feedback', Icon: MessageSquare },
  { href: '/admin/funnel', label: 'Funil', Icon: TrendingUp },
  { href: '/admin/costs', label: 'Custos', Icon: DollarSign },
  { href: '/admin/billing', label: 'Faturamento', Icon: CreditCard, adminOnly: true },
];

export function AdminSidebar({ role = 'admin' }: { role?: 'admin' | 'gestor' }) {
  const pathname = usePathname();
  const items = ITEMS.filter((it) => !it.adminOnly || role === 'admin');
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card/60 backdrop-blur-md flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-border">
        <Link href="/" className="inline-flex items-center mb-3">
          <BrandLogo size="md" priority />
        </Link>
        <div className="text-[10px] font-medium uppercase tracking-wider text-brand">
          {role === 'gestor' ? 'Gestor' : 'Admin'}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {items.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname?.startsWith(href + '/');
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
              <Icon className="h-4 w-4" aria-hidden="true" />
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
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar ao chat</span>
        </Link>
      </div>
    </aside>
  );
}
