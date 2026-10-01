import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { UnifiedDashboard } from '@/components/dashboard/UnifiedDashboard';

export const dynamic = 'force-dynamic';

// Painel unificado do cliente (dashboard estilo BI). Gated também no
// middleware.ts; o guard aqui é defesa em profundidade.
export default async function PainelPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/painel');

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <UnifiedDashboard />
    </AppShell>
  );
}
