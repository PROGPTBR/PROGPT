import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { GestaoDemandasDemo } from '@/components/vitrine/demandas/GestaoDemandasDemo';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const dynamic = 'force-dynamic';

// Vitrine "Gestão de Demandas" (sub-projeto 68): produto implantado sob demanda.
// Esta aba carrega SÓ dados de exemplo em memória — sem banco, sem gravação.
export default async function GestaoDemandasPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/gestao-demandas');

  return (
    <AppShell width="wide">
      <GestaoDemandasDemo hojeIso={hojeEmBrasilia()} />
    </AppShell>
  );
}
