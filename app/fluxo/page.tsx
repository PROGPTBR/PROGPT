import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { listarProcessos } from '@/lib/fluxo/process';
import { FluxoRoot } from '@/components/fluxo/FluxoRoot';
import { usuarioComFluxo } from '@/lib/fluxo/acesso-servidor';

export const dynamic = 'force-dynamic';

export default async function FluxoPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fluxo');

  // Sob demanda: só a lista liberada usa de verdade; os demais veem a vitrine
  // (modo guiado + processo de exemplo), sem processos próprios.
  const liberado = await usuarioComFluxo(user);
  const processos = liberado ? await listarProcessos(user.id) : [];

  return <FluxoRoot processosIniciais={processos} liberado={liberado} />;
}
