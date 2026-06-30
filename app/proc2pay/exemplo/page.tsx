import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { buildExampleProcess } from '@/lib/proc2pay/example';
import { Header } from '../../login/header';
import { ProcessCockpit } from '@/components/proc2pay/ProcessCockpit';

export const dynamic = 'force-dynamic';

// Tela de exemplo do Proc2Pay — processo-demo em memória (sem DB nem LLM),
// renderizado em modo leitura. Rota estática tem precedência sobre /[id].

export default async function Proc2PayExamplePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/proc2pay/exemplo');

  const { process, stageRuns } = buildExampleProcess();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background text-foreground font-outfit antialiased">
        <main className="mx-auto max-w-4xl px-6 pt-24 pb-16">
          <ProcessCockpit initialProcess={process} initialStageRuns={stageRuns} example />
        </main>
      </div>
    </>
  );
}
