import { Suspense } from 'react';
import { SuppliersAssistant } from '@/components/assistants/SuppliersAssistant';
import { getCurrentUser } from '@/lib/auth';
import { equipeDoUsuario } from '@/lib/suppliers/busca-ampliada';

export const dynamic = 'force-dynamic';

export default async function SuppliersAssistantPage() {
  // Busca ampliada (vendor list + internet) só para equipes liberadas.
  const user = await getCurrentUser();
  const buscaAmpliada = equipeDoUsuario(user?.email) !== null;

  return (
    <Suspense fallback={null}>
      <SuppliersAssistant buscaAmpliada={buscaAmpliada} />
    </Suspense>
  );
}
