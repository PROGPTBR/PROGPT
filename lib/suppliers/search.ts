import { getReceitaSql } from './receita-db';
import { getCnaeByCode } from './cnae-lookup';
import { extractYear } from './ranking';
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

// Nomes candidatos da coluna de data de abertura na base `empresas` (a
// tabela é operada por outro projeto; o nome pode variar entre dumps da
// Receita). Detectado UMA vez via information_schema e cacheado — se nenhuma
// existir, o tempo de mercado fica desligado (nunca quebra a query).
const OPENING_COLUMN_CANDIDATES = [
  'data_abertura',
  'data_inicio_atividade',
  'data_inicio_atividades',
  'data_de_abertura',
];
let openingColumnCache: string | null | undefined;

async function getOpeningColumn(
  sql: ReturnType<typeof getReceitaSql>,
): Promise<string | null> {
  if (openingColumnCache !== undefined) return openingColumnCache;
  try {
    const rows = await sql<Array<{ column_name: string }>>`
      select column_name from information_schema.columns
      where table_name = 'empresas'
        and column_name = any(${OPENING_COLUMN_CANDIDATES}::text[])
      limit 1
    `;
    openingColumnCache = rows[0]?.column_name ?? null;
  } catch {
    openingColumnCache = null;
  }
  return openingColumnCache;
}

export async function searchSuppliers(
  params: SearchRequest,
): Promise<SearchResponse> {
  const { cnae, ufs, limit = DEFAULT_LIMIT, offset = 0 } = params;
  const sql = getReceitaSql();

  const ufFilter = ufs && ufs.length > 0 ? ufs : null;
  const openCol = await getOpeningColumn(sql);

  // Fragmentos condicionais pro tempo de mercado (só quando a coluna existe).
  const openingSelect = openCol ? sql`, ${sql(openCol)} as abertura` : sql``;
  const openingAgg = openCol ? sql`, min(abertura) as abertura_min` : sql``;
  const openingOrder = openCol ? sql`min(abertura) asc nulls last,` : sql``;

  let groups: GroupedSupplier[] = [];
  let count = 0;
  try {
    // ORDER BY = SCORE DE APTIDÃO (não mais só capital social):
    //   +100  CNAE buscado é a ATIVIDADE PRINCIPAL de alguma unidade
    //   + 40  tem contato (telefone/email) em alguma unidade
    //   +0/10/20/30  porte (ME<EPP<DEMAIS)
    // desempate: mais antiga primeiro (tempo de mercado), depois maior
    // capital, depois razão social. Capital deixa de dominar o topo (jogava
    // holding/empresa-de-fachada pra cima).
    const dbRows = await sql<RawGroupRow[]>`
      with matches as (
        select cnpj, razao_social, nome_fantasia, cnae_primario, cnaes_secundarios,
               porte, capital_social, faixa_funcionarios, uf, municipio,
               telefone, email, ultima_atualizacao_rf,
               (cnae_primario = ${cnae}) as is_primary,
               (telefone is not null or email is not null) as has_contact
               ${openingSelect}
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
             ${openingAgg}
      from matches
      group by substring(cnpj from 1 for 8)
      order by (
                 (case when bool_or(is_primary) then 100 else 0 end)
                 + (case when bool_or(has_contact) then 40 else 0 end)
                 + (max(case porte when 'DEMAIS' then 3 when 'EPP' then 2 when 'ME' then 1 else 0 end) * 10)
               ) desc,
               ${openingOrder}
               max(capital_social) desc nulls last,
               min(razao_social) asc
      limit ${limit}
      offset ${offset}
    `;

    groups = dbRows.map((row) => ({
      cnpjBasico: row.cnpj_basico,
      units: row.units.map(normalizeRow),
      aberturaAno: extractYear(row.abertura_min ?? null),
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
  abertura_min?: Date | string | null;
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
