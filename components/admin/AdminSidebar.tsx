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
  ArrowLeft,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';

const ITEMS = [
  { href: '/admin/users', label: 'Usuários', Icon: Users },
  { href: '/admin/articles', label: 'Artigos', Icon: FileText },
  { href: '/admin/themes', label: 'Temas', Icon: Tag },
  { href: '/admin/templates', label: 'Templates', Icon: FileCode },
  { href: '/admin/ingest', label: 'Ingestão', Icon: Upload },
  { href: '/admin/feedback', label: 'Feedback', Icon: MessageSquare },
  { href: '/admin/costs', label: 'Custos', Icon: DollarSign },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 shrink-0 border-r border-white/5 bg-black/40 backdrop-blur-md flex flex-col h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-white/5">
        <Link href="/" className="inline-flex items-center mb-3">
          <BrandLogo size="md" priority />
        </Link>
        <div className="text-[10px] font-medium uppercase tracking-wider text-brand">
          Admin
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {ITEMS.map(({ href, label, Icon }) => {
          const active =
            pathname === href || pathname?.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-brand/10 border border-brand/20 text-white font-medium'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-2 border-t border-white/5">
        <Link
          href="/chat"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar ao chat</span>
        </Link>
      </div>
    </aside>
  );
}
