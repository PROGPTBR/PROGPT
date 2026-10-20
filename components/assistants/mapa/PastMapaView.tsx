'use client';

import type { ResultadoMapa } from '@/lib/mapa-fornecedores/tipos';
import { MapaResultado } from './MapaResultado';

// Histórico: reabre um mapeamento salvo (assistant_runs.params = ResultadoMapa).
export function PastMapaView({ runId, resultado }: { runId: string; resultado: ResultadoMapa }) {
  const data = new Date(resultado.geradoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Mapa de Fornecedores da Operação <span className="text-brand">.</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerado em {data}. A lista vem de busca na internet: confirme na homologação.</p>
      </div>
      <MapaResultado plano={resultado.plano} fornecedores={resultado.fornecedores} relatorio={resultado.relatorio} runId={runId} />
    </div>
  );
}
