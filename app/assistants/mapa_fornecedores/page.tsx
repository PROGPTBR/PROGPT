import { redirect } from 'next/navigation';
import { MapaFornecedoresAssistant } from '@/components/assistants/mapa/MapaFornecedoresAssistant';
import { getCurrentUser } from '@/lib/auth';
import { moduloBloqueado } from '@/lib/modulos/servidor';

export const dynamic = 'force-dynamic';

// Desde 2026-10-22 o Mapa vive na mesma tela da Busca de Fornecedores
// (/assistants/suppliers?tipo=operacao). Este endereço continua valendo porque
// o chat, o painel lateral e o histórico apontam para ele. Se a empresa tiver
// a Busca desligada, o Mapa abre sozinho aqui.
export default async function MapaFornecedoresPage({ searchParams }: { searchParams: { q?: string } }) {
  const pedido = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 8000) : '';
  const user = await getCurrentUser();
  if (!user || !(await moduloBloqueado(user.id, 'suppliers'))) {
    const qs = new URLSearchParams({ tipo: 'operacao' });
    if (pedido) qs.set('q', pedido);
    redirect(`/assistants/suppliers?${qs.toString()}`);
  }
  return <MapaFornecedoresAssistant pedidoInicial={pedido} />;
}
