import { getReceitaSql } from './receita-db';
import { getCnaeByCode } from './cnae-lookup';
import type { SearchRequest, SearchResponse, SupplierResult } from './types';

// Busca em `empresas` filtrada por CNAE (primário OU secundário) + UFs.
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
const COUNT_CAP = 500;  // o "total" mostrado pra UI é cap de 500 — evita
                        // count() pesado nas 124K rows do CNAE genérico.

export async function searchSuppliers(
  params: SearchRequest,
): Promise<SearchResponse> {
  const { cnae, ufs, limit = DEFAULT_LIMIT, offset = 0 } = params;
  const sql = getReceitaSql();

  const ufFilter = ufs && ufs.length > 0 ? ufs : null;

  let rows: SupplierResult[];
  let count = 0;
  try {
    const dbRows = await sql<RawEmpresaRow[]>`
      select cnpj,
             razao_social,
             nome_fantasia,
             cnae_primario,
             cnaes_secundarios,
             porte,
             capital_social,
             faixa_funcionarios,
             uf,
             municipio,
             telefone,
             email,
             ultima_atualizacao_rf
      from empresas
      where (cnae_primario = ${cnae}
             or ${cnae} = any(coalesce(cnaes_secundarios, array[]::varchar[])))
        and (${ufFilter}::text[] is null or uf = any(${ufFilter}::text[]))
        and situacao_cadastral = 'ATIVA'
      order by capital_social desc nulls last,
               case porte when 'DEMAIS' then 0 when 'EPP' then 1 when 'ME' then 2 else 3 end asc,
               razao_social asc
      limit ${limit}
      offset ${offset}
    `;
    rows = dbRows.map(normalizeRow);

    // Count separado, com cap pra não escanear tudo.
    const countRows = await sql<Array<{ total: number }>>`
      select count(*)::int as total
      from (
        select 1
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
    rows = [];
    count = 0;
  }

  const cnaeInfo = await getCnaeByCode(cnae);

  return {
    suppliers: rows,
    total: count,
    cnaeName: cnaeInfo?.name ?? null,
  };
}

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
