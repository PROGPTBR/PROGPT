import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { buildExampleProcess } from '@/lib/proc2pay/example';
import { AppShell } from '@/components/layout/AppShell';
import { ProcessCockpit } from '@/components/proc2pay/ProcessCockpit';

export const dynamic = 'force-dynamic';

// Tela de exemplo do Proc2Pay — processo-demo em memória (sem DB nem LLM),
// renderizado em modo leitura. Rota estática tem precedência sobre /[id].

export default async function Proc2PayExamplePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/proc2pay/exemplo');

  const { process, stageRuns } = buildExampleProcess();

  return (
    <AppShell back={{ href: '/proc2pay', label: 'Processos' }}>
      <ProcessCockpit initialProcess={process} initialStageRuns={stageRuns} example />
    </AppShell>
  );
}
