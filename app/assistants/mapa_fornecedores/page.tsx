import { MapaFornecedoresAssistant } from '@/components/assistants/mapa/MapaFornecedoresAssistant';

export const dynamic = 'force-dynamic';

export default function MapaFornecedoresPage({ searchParams }: { searchParams: { q?: string } }) {
  const pedido = typeof searchParams.q === 'string' ? searchParams.q.slice(0, 8000) : '';
  return <MapaFornecedoresAssistant pedidoInicial={pedido} />;
}
