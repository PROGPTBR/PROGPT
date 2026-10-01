import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProcessForOwner, listStageRuns } from '@/lib/proc2pay/process';
import { AppShell } from '@/components/layout/AppShell';
import { ProcessCockpit } from '@/components/proc2pay/ProcessCockpit';

export const dynamic = 'force-dynamic';

export default async function Proc2PayProcessPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/proc2pay/${params.id}`);

  const process = await getProcessForOwner(user.id, params.id);
  if (!process) notFound();

  const stageRuns = await listStageRuns(user.id, params.id);

  return (
    <AppShell back={{ href: '/proc2pay', label: 'Processos' }}>
      <ProcessCockpit initialProcess={process} initialStageRuns={stageRuns} />
    </AppShell>
  );
}
