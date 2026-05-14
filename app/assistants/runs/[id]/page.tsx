import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { PastRfpView } from '@/components/assistants/PastRfpView';
import type { RfpParams } from '@/lib/assistants/types';

export const dynamic = 'force-dynamic';

export default async function AssistantRunDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/assistants/runs/${params.id}`);

  const run = await getRunForOwner(params.id, user.id);
  if (!run) notFound();

  if (run.status !== 'done' || !run.output_md) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-xl font-semibold">RFP em andamento</h1>
        <p className="text-sm text-muted-foreground">
          Este RFP está com status <span className="font-medium">{run.status}</span>
          {run.error_message ? ` — ${run.error_message}` : ''}. Aguarde a finalização ou
          gere novamente.
        </p>
      </div>
    );
  }

  const scope = (run.params as RfpParams).scope ?? '(sem escopo)';

  return (
    <PastRfpView runId={run.id} initialOutput={run.output_md} scope={scope} />
  );
}
