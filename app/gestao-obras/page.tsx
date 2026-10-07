import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { GestaoObrasDemo } from '@/components/vitrine/obras/GestaoObrasDemo';
import { hojeEmBrasilia } from '@/lib/vitrine/datas';
import { podeVerSistemaCompleto } from '@/lib/vitrine/sistema-completo';
import { SistemaCompletoFrame } from '@/components/vitrine/SistemaCompletoFrame';

export const dynamic = 'force-dynamic';

// Vitrine "Gestão de Obras" (sub-projeto 68): produto implantado sob demanda.
// Esta aba carrega SÓ dados de exemplo em memória — sem banco, sem gravação.
export default async function GestaoObrasPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/gestao-obras');

  // Quem apresenta o produto (sub-projeto 74) vê o sistema completo de
  // demonstração; os demais seguem com a vitrine.
  if (podeVerSistemaCompleto(user.email)) {
    return (
      <AppShell width="wide" fill>
        <div className="min-h-0 flex-1">
          <SistemaCompletoFrame sistema="obras" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell width="wide">
      <GestaoObrasDemo hojeIso={hojeEmBrasilia()} />
    </AppShell>
  );
}
