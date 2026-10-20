import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { processoExemplo } from '@/lib/fluxo/exemplo';
import { usuarioComFluxo } from '@/lib/fluxo/acesso-servidor';
import { ProcessoRoot } from '@/components/fluxo/ProcessoRoot';

export const dynamic = 'force-dynamic';

// Processo de exemplo do Fluxo (vitrine sob demanda): roda todo no navegador,
// com resultados prontos, sem IA e sem gravar nada.
export default async function FluxoExemploPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/fluxo/exemplo');
  const liberado = await usuarioComFluxo(user);

  return <ProcessoRoot processoInicial={processoExemplo()} etapasIniciais={[]} exemplo liberado={liberado} />;
}
