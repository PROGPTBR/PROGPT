import Link from 'next/link';
import { History } from 'lucide-react';
import { requireUser, NotAuthenticated } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { TelaCheiaBotao } from '@/components/layout/TelaCheiaBotao';

export const dynamic = 'force-dynamic';

export default async function AssistantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/assistants');
    throw err;
  }
  // Acesso liberado a todo usuário logado (decisão 2026-07-07: cartão no
  // cadastro ⇒ sem bloqueio de pagamento in-app; cobrança fica no Asaas).
  // Gate antigo (hasAccess → /assinar) removido — ver git para reabilitar.
  return (
    // Largura larga: as análises (tabelas, gráficos, relatórios) precisam de
    // espaço; a padrão deixava a tela "muito pequena" (cliente, 2026-10-08).
    // O botão "Tela cheia" vale para todos os agentes.
    <AppShell
      width="wide"
      back={{ href: '/chat', label: 'Voltar ao chat' }}
      actions={
        <div className="flex items-center gap-3">
        <TelaCheiaBotao />
        <Link data-tour="assistentes-historico"
          href="/assistants/history"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <History className="h-4 w-4" aria-hidden="true" />
          Histórico
        </Link>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
