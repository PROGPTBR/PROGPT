import { redirect } from 'next/navigation';

import { requireUser, NotAuthenticated } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';

// Mesma moldura das outras telas do produto (/assistants, /painel): topo com
// navegação + container centrado. Sem isto o /fluxo abria colado na borda, sem
// jeito de voltar.
export default async function FluxoLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireUser();
  } catch (err) {
    if (err instanceof NotAuthenticated) redirect('/login?next=/fluxo');
    throw err;
  }

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      {children}
    </AppShell>
  );
}
