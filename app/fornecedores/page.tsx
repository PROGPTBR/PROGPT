import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/layout/AppShell';
import { FornecedoresBaseTabs } from '@/components/suppliers/FornecedoresBaseTabs';

export const dynamic = 'force-dynamic';

// "Minha base de fornecedores" — vendor master curado pelo comprador. Gated
// também no middleware.ts; o guard aqui é defesa em profundidade.
export default async function FornecedoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fornecedores');

  return (
    <AppShell back={{ href: '/chat', label: 'Voltar ao chat' }}>
      <FornecedoresBaseTabs />
    </AppShell>
  );
}
