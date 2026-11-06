import type { Metadata } from 'next';

import { getPedidoPorToken, nomeDaEmpresa, visaoFornecedor } from '@/lib/recebimento/service';
import { LinkIndisponivel, PublicoShell } from '@/components/fluxo/publico/PublicoShell';
import { PortalFornecedor } from '@/components/recebimento/PortalFornecedor';

export const dynamic = 'force-dynamic';

// Recebimento de NF (sub-projeto 95). Página PÚBLICA, fora do matcher do
// middleware: o fornecedor não tem conta. O token do link é a credencial.
export const metadata: Metadata = { title: 'Nota fiscal do pedido | PROGPT', robots: { index: false, follow: false } };

export default async function PortalFornecedorPage({ params }: { params: { token: string } }) {
  const c = await getPedidoPorToken('fornecedor', params.token);
  if (!c) {
    return (
      <PublicoShell>
        <LinkIndisponivel titulo="Link indisponível" texto="Este link não é válido. Peça ao comprador um novo link." />
      </PublicoShell>
    );
  }
  const aberto = c.pedido.status !== 'cancelado' && !c.pedido.pagamento_liberado_em;
  return (
    <PublicoShell>
      <PortalFornecedor token={params.token} visao={visaoFornecedor(c, await nomeDaEmpresa(c.pedido.user_id))} aberto={aberto} />
    </PublicoShell>
  );
}
