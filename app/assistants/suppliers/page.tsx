import { Suspense } from 'react';
import { SuppliersAssistant } from '@/components/assistants/SuppliersAssistant';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SuppliersAssistantPage() {
  // Busca ampliada (vendor list + internet) só para equipes liberadas.
  const user = await getCurrentUser();
  // Busca ampliada (vendor list + internet) liberada para todos em 2026-10-21.
  const buscaAmpliada = !!user;

  return (
    <Suspense fallback={null}>
      <SuppliersAssistant buscaAmpliada={buscaAmpliada} />
    </Suspense>
  );
}
