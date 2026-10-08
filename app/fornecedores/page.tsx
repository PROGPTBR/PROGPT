import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { FornecedoresBaseTabs } from '@/components/suppliers/FornecedoresBaseTabs';
import { equipeDoUsuario } from '@/lib/suppliers/busca-ampliada';

export const dynamic = 'force-dynamic';

// "Minha base de fornecedores" — vendor master curado pelo comprador. Gated
// também no middleware.ts; o guard aqui é defesa em profundidade.
export default async function FornecedoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fornecedores');

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      {/* Busca na internet só para as equipes liberadas (lib/suppliers/busca-ampliada.ts). */}
      <FornecedoresBaseTabs buscaNaInternet={equipeDoUsuario(user.email) !== null} />
    </AppShell>
  );
}
