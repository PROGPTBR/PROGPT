import type { Metadata } from 'next';

import { getPedidoPorToken, visaoAlmoxarifado } from '@/lib/recebimento/service';
import { LinkIndisponivel, PublicoShell } from '@/components/fluxo/publico/PublicoShell';
import { PortalAlmoxarifado } from '@/components/recebimento/PortalAlmoxarifado';

export const dynamic = 'force-dynamic';

// Recebimento de NF (sub-projeto 95). Página PÚBLICA: o token é a credencial.
// Só recebe a visão SEM VALORES (visaoAlmoxarifado).
export const metadata: Metadata = { title: 'Conferência de recebimento | PROGPT', robots: { index: false, follow: false } };

export default async function PortalAlmoxarifadoPage({ params }: { params: { token: string } }) {
  const c = await getPedidoPorToken('almoxarifado', params.token);
  if (!c) {
    return (
      <PublicoShell>
        <LinkIndisponivel titulo="Link indisponível" texto="Este link não é válido. Peça ao comprador um novo link." />
      </PublicoShell>
    );
  }
  return (
    <PublicoShell>
      <PortalAlmoxarifado token={params.token} visaoInicial={visaoAlmoxarifado(c)} />
    </PublicoShell>
  );
}
