import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { PainelRoot } from '@/components/fluxo/PainelRoot';
import { usuarioComFluxo } from '@/lib/fluxo/acesso-servidor';

export const dynamic = 'force-dynamic';

export default async function FluxoPainelPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fluxo/painel');
  // Sob demanda: quem só tem a vitrine não tem processos para gerir.
  if (!(await usuarioComFluxo(user))) redirect('/fluxo');

  return <PainelRoot />;
}
