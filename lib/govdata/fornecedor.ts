// Histórico público de um fornecedor: itens homologados em compras públicas
// federais (Compras.gov.br — resultado de contratações Lei 14.133). Sinal de
// "fornece pro governo" (capacidade operacional / idoneidade) na homologação.
// Token-free. Fail-soft. Contrato em docs/product/govdata-api-contract.md.

import { govGet } from './client';
import { cached } from './cache';
import type { ComprasPage } from './types';

const JANELA_MESES = 12;

interface RawResultado {
  valorTotalHomologado: number;
  unidadeOrgaoUfSigla: string;
  orgaoEntidadeCnpj: string;
  nomeRazaoSocialFornecedor: string;
}

export interface HistoricoPublico {
  cnpj: string;
  consultado: boolean; // a consulta respondeu?
  forneceAoGoverno: boolean; // tem ao menos 1 item homologado no período
  totalItens: number; // total no período (totalRegistros)
  amostra: number; // itens trazidos na página
  valorAmostra: number; // soma dos valores homologados da amostra (R$)
  ufs: string[]; // UFs distintas dos órgãos compradores
  nOrgaos: number; // órgãos compradores distintos
  razaoSocial: string; // razão social conforme as compras
  periodoMeses: number;
  error?: string;
}

/** Agrega os itens homologados (puro/testável). */
export function aggregateResultados(
  rows: RawResultado[],
  totalRegistros: number,
  periodoMeses: number,
): HistoricoPublico {
  const ufs = Array.from(
    new Set(rows.map((r) => (r.unidadeOrgaoUfSigla || '').trim()).filter(Boolean)),
  );
  const orgaos = new Set(rows.map((r) => (r.orgaoEntidadeCnpj || '').trim()).filter(Boolean));
  const valorAmostra = rows
    .map((r) => Number(r.valorTotalHomologado))
    .filter((v) => Number.isFinite(v) && v > 0)
    .reduce((a, v) => a + v, 0);

  return {
    cnpj: '',
    consultado: true,
    forneceAoGoverno: totalRegistros > 0,
    totalItens: totalRegistros,
    amostra: rows.length,
    valorAmostra: Math.round(valorAmostra * 100) / 100,
    ufs,
    nOrgaos: orgaos.size,
    razaoSocial: rows[0]?.nomeRazaoSocialFornecedor ?? '',
    periodoMeses,
  };
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '');
}

/** dd → 'YYYY-MM-DD' (UTC, estável). */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Histórico de fornecimento público do CNPJ nos últimos 12 meses. Fail-soft:
 * erro → { consultado:false }. Cacheado 24h. A janela ≤ 365 dias é exigência da API.
 */
export async function historicoPublico(cnpj: string): Promise<HistoricoPublico> {
  const d = onlyDigits(cnpj);
  const empty: HistoricoPublico = {
    cnpj: d,
    consultado: false,
    forneceAoGoverno: false,
    totalItens: 0,
    amostra: 0,
    valorAmostra: 0,
    ufs: [],
    nOrgaos: 0,
    razaoSocial: '',
    periodoMeses: JANELA_MESES,
  };
  if (d.length !== 14) return empty;

  try {
    return await cached(`historico-publico:${d}`, async () => {
      const fim = new Date();
      const ini = new Date(fim.getTime() - 364 * 24 * 60 * 60 * 1000); // < 365 dias
      const page = await govGet<ComprasPage<RawResultado>>(
        'compras',
        '/modulo-contratacoes/3_consultarResultadoItensContratacoes_PNCP_14133',
        {
          niFornecedor: d,
          dataResultadoPncpInicial: ymd(ini),
          dataResultadoPncpFinal: ymd(fim),
          pagina: 1,
          tamanhoPagina: 500,
        },
      );
      const agg = aggregateResultados(
        page.resultado ?? [],
        page.totalRegistros ?? (page.resultado?.length ?? 0),
        JANELA_MESES,
      );
      return { ...agg, cnpj: d };
    });
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) };
  }
}
