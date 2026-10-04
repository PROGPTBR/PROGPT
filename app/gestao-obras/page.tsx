import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { GestaoObrasDemo } from '@/components/vitrine/obras/GestaoObrasDemo';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';

export const dynamic = 'force-dynamic';

// Vitrine "Gestão de Obras" (sub-projeto 68): produto implantado sob demanda.
// Esta aba carrega SÓ dados de exemplo em memória — sem banco, sem gravação.
export default async function GestaoObrasPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/gestao-obras');

  return (
    <AppShell width="wide">
      <GestaoObrasDemo hojeIso={hojeEmBrasilia()} />
    </AppShell>
  );
}
