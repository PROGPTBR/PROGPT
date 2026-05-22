import { getReceitaSql } from './receita-db';
import { getCnaeByCode } from './cnae-lookup';
import type {
  GroupedSupplier,
  SearchRequest,
  SearchResponse,
  SupplierResult,
} from './types';

// Busca em `empresas` filtrada por CNAE (primário OU secundário) + UFs.
//
// Resultados são agrupados por `cnpj_basico` (8 primeiros dígitos do CNPJ)
// via `json_agg`: 1 grupo = 1 empresa-mãe, units = filiais que batem no
// filtro. Empresas com várias filiais ativas (ex: AMBEV em vários estados)
// aparecem como 1 card por empresa com expand pra ver cada unidade.
//
// Índices usados:
//   - idx_empresas_cnae_primario (btree em cnae_primario)
//   - empresas_cnaes_secundarios_gin (GIN em ARRAY cnaes_secundarios)
//   - idx_empresas_uf_municipio (btree composto)
//
// `situacao_cadastral` foi inspecionada — só existe valor 'ATIVA' nas 124K
// rows. Filtro mantido por segurança (caso outros valores apareçam em
// refreshes futuros), mas hoje é no-op.

const DEFAULT_LIMIT = 50;
const COUNT_CAP = 500; // cap defensivo de empresas distintas

export async function searchSuppliers(
  params: SearchRequest,
): Promise<SearchResponse> {
  const { cnae, ufs, limit = DEFAULT_LIMIT, offset = 0 } = params;
  const sql = getReceitaSql();

  const ufFilter = ufs && ufs.length > 0 ? ufs : null;

  let groups: GroupedSupplier[] = [];
  let count = 0;
  try {
    const dbRows = await sql<RawGroupRow[]>`
      with matches as (
        select cnpj, razao_social, nome_fantasia, cnae_primario, cnaes_secundarios,
               porte, capital_social, faixa_funcionarios, uf, municipio,
               telefone, email, ultima_atualizacao_rf
        from empresas
        where (cnae_primario = ${cnae}
               or ${cnae} = any(coalesce(cnaes_secundarios, array[]::varchar[])))
          and (${ufFilter}::text[] is null or uf = any(${ufFilter}::text[]))
          and situacao_cadastral = 'ATIVA'
      )
      select substring(cnpj from 1 for 8) as cnpj_basico,
             json_agg(
               json_build_object(
                 'cnpj', cnpj,
                 'razao_social', razao_social,
                 'nome_fantasia', nome_fantasia,
                 'cnae_primario', cnae_primario,
                 'cnaes_secundarios', cnaes_secundarios,
                 'porte', porte,
                 'capital_social', capital_social,
                 'faixa_funcionarios', faixa_funcionarios,
                 'uf', uf,
                 'municipio', municipio,
                 'telefone', telefone,
                 'email', email,
                 'ultima_atualizacao_rf', ultima_atualizacao_rf
               )
               order by cnpj asc
             ) as units
      from matches
      group by substring(cnpj from 1 for 8)
      order by max(capital_social) desc nulls last,
               min(razao_social) asc
      limit ${limit}
      offset ${offset}
    `;

    groups = dbRows.map((row) => ({
      cnpjBasico: row.cnpj_basico,
      units: row.units.map(normalizeRow),
    }));

    // Distinct-company count com cap.
    const countRows = await sql<Array<{ total: number }>>`
      select count(*)::int as total
      from (
        select distinct substring(cnpj from 1 for 8) as cnpj_basico
        from empresas
        where (cnae_primario = ${cnae}
               or ${cnae} = any(coalesce(cnaes_secundarios, array[]::varchar[])))
          and (${ufFilter}::text[] is null or uf = any(${ufFilter}::text[]))
          and situacao_cadastral = 'ATIVA'
        limit ${COUNT_CAP}
      ) capped
    `;
    count = countRows[0]?.total ?? 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[suppliers/search] query failed:', msg);
    groups = [];
    count = 0;
  }

  const cnaeInfo = await getCnaeByCode(cnae);

  return {
    groups,
    total: count,
    cnaeName: cnaeInfo?.name ?? null,
  };
}

type RawGroupRow = {
  cnpj_basico: string;
  units: RawEmpresaRow[];
};

type RawEmpresaRow = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_primario: string | null;
  cnaes_secundarios: string[] | null;
  porte: string | null;
  capital_social: string | number | null;
  faixa_funcionarios: string | null;
  uf: string | null;
  municipio: string | null;
  telefone: string | null;
  email: string | null;
  ultima_atualizacao_rf: Date | string | null;
};

function normalizeRow(r: RawEmpresaRow): SupplierResult {
  return {
    cnpj: r.cnpj,
    razao_social: r.razao_social,
    nome_fantasia: r.nome_fantasia,
    cnae_primario: r.cnae_primario,
    cnaes_secundarios: r.cnaes_secundarios,
    porte: r.porte === 'None' ? null : r.porte,
    capital_social:
      r.capital_social === null || r.capital_social === undefined
        ? null
        : typeof r.capital_social === 'number'
          ? r.capital_social
          : Number(r.capital_social),
    faixa_funcionarios: r.faixa_funcionarios,
    uf: r.uf?.trim() ?? null,
    municipio: r.municipio,
    telefone: r.telefone,
    email: r.email,
    ultima_atualizacao_rf:
      r.ultima_atualizacao_rf instanceof Date
        ? r.ultima_atualizacao_rf.toISOString().slice(0, 10)
        : r.ultima_atualizacao_rf,
  };
}

export { normalizeRow };
