import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth';
import { getPedido, linkDoPapel } from '@/lib/recebimento/service';
import { PedidoRecebimento } from '@/components/recebimento/PedidoRecebimento';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pedido | Recebimento de NF | PROGPT' };

export default async function PedidoPage({ params }: { params: { id: string } }) {
  const u = await requireUser();
  const c = await getPedido(u.id, params.id);
  if (!c) notFound();

  return (
    <PedidoRecebimento
      pedido={c.pedido}
      notas={c.notas}
      entradas={c.entradas}
      saldo={c.saldo}
      links={{
        fornecedor: linkDoPapel('fornecedor', c.pedido.fornecedor_token),
        almoxarifado: linkDoPapel('almoxarifado', c.pedido.almoxarifado_token),
        financeiro: linkDoPapel('financeiro', c.pedido.financeiro_token),
      }}
    />
  );
}
