import { Suspense } from 'react';
import { FornecedoresUnificado, type TipoBusca } from '@/components/assistants/FornecedoresUnificado';
import { getCurrentUser } from '@/lib/auth';
import { moduloBloqueado } from '@/lib/modulos/servidor';

export const dynamic = 'force-dynamic';

// Busca de Fornecedores e Mapa da Operação na mesma tela (2026-10-22): o
// cliente escolhe primeiro o que quer encontrar. ?tipo=item|operacao abre
// direto no modo; ?q= sem tipo é pedido de item (links do chat e da base).
export default async function SuppliersAssistantPage({
  searchParams,
}: {
  searchParams: { tipo?: string; q?: string };
}) {
  const user = await getCurrentUser();
  // Busca ampliada (vendor list + internet) liberada para todos em 2026-10-21.
  const buscaAmpliada = !!user;
  const mapaLiberado = user ? !(await moduloBloqueado(user.id, 'mapa_fornecedores')) : true;

  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const tipo: TipoBusca | null =
    searchParams.tipo === 'item' || searchParams.tipo === 'operacao'
      ? searchParams.tipo
      : q
        ? 'item'
        : null;

  return (
    <Suspense fallback={null}>
      <FornecedoresUnificado
        tipoInicial={tipo}
        mapaLiberado={mapaLiberado}
        buscaAmpliada={buscaAmpliada}
        pedidoMapa={tipo === 'operacao' ? q.slice(0, 8000) : ''}
      />
    </Suspense>
  );
}
