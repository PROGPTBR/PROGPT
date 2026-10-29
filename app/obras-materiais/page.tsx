import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { SistemaCompletoFrame } from '@/components/vitrine/SistemaCompletoFrame';

export const dynamic = 'force-dynamic';

// Obras & Materiais PROGPT (sub-projeto 91) no menu Gestão, para todos os
// clientes logados: sistema completo de demonstração, só dados fictícios no
// navegador (public/demos/obrasmateriais), sem banco e sem gravação real.
export default async function ObrasMateriaisPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/obras-materiais');

  return (
    <AppShell width="wide" fill>
      <div className="min-h-0 flex-1">
        <SistemaCompletoFrame sistema="obrasmateriais" />
      </div>
    </AppShell>
  );
}
