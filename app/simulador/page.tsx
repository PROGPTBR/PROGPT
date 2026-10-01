import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { SimuladorFrame } from '@/components/simulador/SimuladorFrame';

export const dynamic = 'force-dynamic';

// Simulador Tributário — religado pro público em 2026-09-02 (decisão do
// diretor). Era "Em breve" pra não-admin desde 2026-08-19 (admin via
// <SimuladorFrame/> validava antes do religamento geral); agora todo
// usuário logado com acesso à página (gate de assinatura já é feito no
// middleware.ts) vê o simulador funcional.
export default async function SimuladorPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador');

  return (
    <AppShell width="wide" fill back={{ href: '/assistants', label: 'Assistentes' }}>
      <div className="min-h-0 flex-1">
        <SimuladorFrame />
      </div>
    </AppShell>
  );
}
