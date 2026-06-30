import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getProcessForOwner, listStageRuns } from '@/lib/proc2pay/process';
import { Header } from '../../login/header';
import { ProcessCockpit } from '@/components/proc2pay/ProcessCockpit';

export const dynamic = 'force-dynamic';

export default async function Proc2PayProcessPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/proc2pay/${params.id}`);

  const process = await getProcessForOwner(user.id, params.id);
  if (!process) notFound();

  const stageRuns = await listStageRuns(user.id, params.id);

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-foreground font-outfit antialiased">
        <main className="mx-auto max-w-4xl px-6 pt-24 pb-16">
          <ProcessCockpit initialProcess={process} initialStageRuns={stageRuns} />
        </main>
      </div>
    </>
  );
}
