import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { DifalSimulator } from '@/components/simulador-logistico/DifalSimulator';

export const dynamic = 'force-dynamic';

// Simulador Logístico (DIFAL) — calculadora determinística (sem LLM no
// caminho de cálculo, ver lib/simulador-logistico/difal.ts). Gated no
// middleware.ts (matcher '/simulador-logistico/:path*'); o guard abaixo é
// defesa em profundidade, mesmo padrão de app/simulador/page.tsx.
export default async function SimuladorLogisticoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/simulador-logistico');

  return (
    <AppShell back={{ href: '/assistants', label: 'Assistentes' }}>
      <DifalSimulator />
    </AppShell>
  );
}
