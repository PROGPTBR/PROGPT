import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { PainelRoot } from '@/components/fluxo/PainelRoot';

export const dynamic = 'force-dynamic';

export default async function FluxoPainelPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fluxo/painel');

  return <PainelRoot />;
}
