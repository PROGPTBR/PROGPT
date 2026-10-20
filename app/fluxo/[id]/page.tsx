import { notFound, redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { getProcesso } from '@/lib/fluxo/process';
import { ProcessoRoot } from '@/components/fluxo/ProcessoRoot';
import { usuarioComFluxo } from '@/lib/fluxo/acesso-servidor';

export const dynamic = 'force-dynamic';

export default async function FluxoProcessoPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/fluxo/${params.id}`);
  if (!(await usuarioComFluxo(user))) redirect('/fluxo');

  const carregado = await getProcesso(user.id, params.id);
  if (!carregado) notFound();

  return <ProcessoRoot processoInicial={carregado.processo} etapasIniciais={carregado.etapas} />;
}
