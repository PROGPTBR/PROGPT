import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { listarProcessos } from '@/lib/fluxo/process';
import { FluxoRoot } from '@/components/fluxo/FluxoRoot';

export const dynamic = 'force-dynamic';

export default async function FluxoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fluxo');

  const processos = await listarProcessos(user.id);

  return <FluxoRoot processosIniciais={processos} />;
}
