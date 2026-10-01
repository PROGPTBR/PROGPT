import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { DataStudio } from '@/components/dashboard/DataStudio';

export const dynamic = 'force-dynamic';

// Dashboard Studio — o cliente joga uma planilha e ela vira um painel denso
// estilo Power BI (KPIs, série temporal, rankings, cruzamentos). Client-side,
// sem DB. Gated no middleware.ts; o guard aqui é defesa em profundidade.
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <DataStudio />
    </AppShell>
  );
}
