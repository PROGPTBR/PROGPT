import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Gauge, Building2, Users, FileCode, Activity, ArrowLeft } from 'lucide-react';
import { requireSuperAdmin, NotSuperAdmin, NotAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// /plataforma — console Super Admin cross-org (fundação "Plataforma",
// 2026-09-14). Shell DELIBERADAMENTE separado de /admin: /admin gerencia o
// conteúdo/usuários de UMA instância (single-tenant hoje); /plataforma
// gerencia TODAS as orgs (tenants) — é o console da 2B Supply como
// provedora da plataforma, não de um cliente específico. Mesma gate
// 404-not-403 usada em /admin (requireSuperAdmin → notFound).
export default async function PlataformaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireSuperAdmin();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/plataforma');
    if (err instanceof NotSuperAdmin) notFound();
    throw err;
  }

  const items = [
    { href: '/plataforma', label: 'Console', Icon: Gauge },
    { href: '/plataforma/operacoes', label: 'Operações', Icon: Building2 },
    { href: '/plataforma/usuarios', label: 'Usuários', Icon: Users },
    { href: '/plataforma/templates', label: 'Templates', Icon: FileCode },
    { href: '/plataforma/monitoramento', label: 'Monitoramento', Icon: Activity },
  ];

  return (
    <div className="flex min-h-screen bg-background text-foreground font-outfit antialiased">
      <aside className="w-56 shrink-0 border-r border-amber-500/30 bg-amber-500/5 flex flex-col h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-amber-500/20">
          <div className="text-sm font-semibold">PROGPT</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Plataforma 2B Supply
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {items.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-amber-500/10 hover:text-foreground border border-transparent transition-colors"
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t border-amber-500/20">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-amber-500/10 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Voltar ao admin</span>
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-x-auto">{children}</main>
    </div>
  );
}
