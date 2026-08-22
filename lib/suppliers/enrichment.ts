// Enriquecimento da Busca de Fornecedores com as 3 bases do governo pedidas
// no backlog do diretor (2026-08-19, ver docs/product/backlog-diretor-2026-08-19.md,
// Batch E): Receita (situação/risco), Compras.gov.br/PNCP (histórico público —
// "fornece pro governo") e Portal da Transparência (sanções CEIS/CNEP).
//
// As 3 fontes já existem no repo (fiscal + govdata, sub-projetos 36/37); este
// módulo só compõe as 3 chamadas por CNPJ, cada uma fail-soft
// INDEPENDENTEMENTE das outras (Promise.allSettled) — uma fonte fora do ar
// não derruba o selo das demais. Cada fonte já cacheia 24h por conta própria
// (lib/fiscal/cache.ts, lib/govdata/cache.ts); nada de cache extra aqui.

import { fetchFiscalSnapshot, snapshotToBadge, type FiscalBadge } from '@/lib/fiscal/snapshot';
import { historicoPublico } from '@/lib/govdata/fornecedor';
import { consultarSancoes, type Sancao } from '@/lib/fiscal/sancoes';

const EMPTY_FISCAL: FiscalBadge = {
  available: false,
  situacao: null,
  score: null,
  risco: null,
};

export type HistoricoLite = {
  consultado: boolean;
  forneceAoGoverno: boolean;
  totalItens: number;
  ufs: string[];
  periodoMeses: number;
};

const EMPTY_HISTORICO: HistoricoLite = {
  consultado: false,
  forneceAoGoverno: false,
  totalItens: 0,
  ufs: [],
  periodoMeses: 12,
};

const MAX_SANCOES_AMOSTRA = 5;

export type SancoesLite = {
  enabled: boolean;
  consultado: boolean;
  temSancao: boolean;
  total: number;
  amostra: Sancao[];
};

const EMPTY_SANCOES: SancoesLite = {
  enabled: false,
  consultado: false,
  temSancao: false,
  total: 0,
  amostra: [],
};

export type SupplierEnrichment = {
  fiscal: FiscalBadge;
  historico: HistoricoLite;
  sancoes: SancoesLite;
  /** Resumo curto e determinístico (sem LLM) pra exibir no card. */
  resumo: string;
};

const RISK_LABEL: Record<string, string> = {
  baixo: 'baixo',
  medio: 'médio',
  alto: 'alto',
  critico: 'crítico',
};

/** Resumo curto e determinístico ("análise minimamente" — sem LLM). */
export function buildResumo(
  fiscal: FiscalBadge,
  historico: HistoricoLite,
  sancoes: SancoesLite,
): string {
  const parts: string[] = [];
  if (sancoes.temSancao) parts.push('⛔ sanção CEIS/CNEP');
  if (fiscal.available) {
    parts.push(fiscal.situacao ?? '—');
    if (fiscal.score != null) {
      parts.push(`risco ${RISK_LABEL[fiscal.risco ?? ''] ?? fiscal.risco}`);
    }
  }
  if (historico.consultado) {
    parts.push(
      historico.forneceAoGoverno
        ? `${historico.totalItens} contrato${historico.totalItens === 1 ? '' : 's'} público${historico.totalItens === 1 ? '' : 's'}/12m`
        : 'sem contratos públicos/12m',
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Nenhuma fonte disponível';
}

/**
 * Enriquece um CNPJ com as 3 bases. Nunca lança — cada fonte cai pro estado
 * vazio/"não consultado" em caso de erro, sem afetar as outras duas.
 */
export async function enrichSupplier(cnpj: string): Promise<SupplierEnrichment> {
  const [fiscalR, historicoR, sancoesR] = await Promise.allSettled([
    fetchFiscalSnapshot(cnpj).then(snapshotToBadge),
    historicoPublico(cnpj),
    consultarSancoes(cnpj),
  ]);

  const fiscal = fiscalR.status === 'fulfilled' ? fiscalR.value : EMPTY_FISCAL;

  const historico: HistoricoLite =
    historicoR.status === 'fulfilled'
      ? {
          consultado: historicoR.value.consultado,
          forneceAoGoverno: historicoR.value.forneceAoGoverno,
          totalItens: historicoR.value.totalItens,
          ufs: historicoR.value.ufs,
          periodoMeses: historicoR.value.periodoMeses,
        }
      : EMPTY_HISTORICO;

  const sancoes: SancoesLite =
    sancoesR.status === 'fulfilled'
      ? {
          enabled: sancoesR.value.enabled,
          consultado: sancoesR.value.consultado,
          temSancao: sancoesR.value.sancoes.length > 0,
          total: sancoesR.value.sancoes.length,
          amostra: sancoesR.value.sancoes.slice(0, MAX_SANCOES_AMOSTRA),
        }
      : EMPTY_SANCOES;

  return { fiscal, historico, sancoes, resumo: buildResumo(fiscal, historico, sancoes) };
}
