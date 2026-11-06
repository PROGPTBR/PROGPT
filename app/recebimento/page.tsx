import type { Metadata } from 'next';

import { requireUser } from '@/lib/auth';
import { listarPedidos } from '@/lib/recebimento/service';
import { RecebimentoRoot } from '@/components/recebimento/RecebimentoRoot';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Recebimento de NF | PROGPT' };

export default async function RecebimentoPage() {
  const u = await requireUser();
  return <RecebimentoRoot pedidosIniciais={await listarPedidos(u.id)} />;
}
