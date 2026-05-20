import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getRunForOwner } from '@/lib/assistants/runs';
import { PastRfpView } from '@/components/assistants/PastRfpView';
import { PastKraljicView } from '@/components/assistants/PastKraljicView';
import { PastPorterView } from '@/components/assistants/PastPorterView';
import { PastFinancialView } from '@/components/assistants/PastFinancialView';
import { PastAbcView } from '@/components/assistants/PastAbcView';
import { PastProfileView } from '@/components/assistants/PastProfileView';
import type {
  RfpParams,
  KraljicParams,
  PorterParams,
  FinancialParams,
  AbcParams,
  ProfileParams,
} from '@/lib/assistants/types';

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
        <h1 className="text-xl font-semibold">Análise em andamento</h1>
        <p className="text-sm text-muted-foreground">
          Este run está com status <span className="font-medium">{run.status}</span>
          {run.error_message ? ` — ${run.error_message}` : ''}. Aguarde a finalização ou
          gere novamente.
        </p>
      </div>
    );
  }

  if (run.assistant_type === 'kraljic') {
    const kp = run.params as KraljicParams;
    return (
      <PastKraljicView
        runId={run.id}
        initialOutput={run.output_md}
        portfolioName={kp.portfolioName ?? '(portfólio sem nome)'}
      />
    );
  }

  if (run.assistant_type === 'porter') {
    const pp = run.params as PorterParams;
    return (
      <PastPorterView
        runId={run.id}
        initialOutput={run.output_md}
        categoria={pp.categoria ?? '(sem categoria)'}
      />
    );
  }

  if (run.assistant_type === 'financial') {
    const fp = run.params as FinancialParams;
    return (
      <PastFinancialView
        runId={run.id}
        initialOutput={run.output_md}
        supplierName={fp.supplierName ?? '(sem fornecedor)'}
      />
    );
  }

  if (run.assistant_type === 'abc') {
    const ap = run.params as AbcParams;
    return (
      <PastAbcView
        runId={run.id}
        initialOutput={run.output_md}
        analysisName={ap.analysisName ?? '(análise sem nome)'}
      />
    );
  }

  if (run.assistant_type === 'profile') {
    const pf = run.params as ProfileParams;
    return (
      <PastProfileView
        runId={run.id}
        initialOutput={run.output_md}
        nomeCategoria={pf.nomeCategoria ?? '(categoria sem nome)'}
      />
    );
  }

  const scope = (run.params as RfpParams).scope ?? '(sem escopo)';
  return <PastRfpView runId={run.id} initialOutput={run.output_md} scope={scope} />;
}
