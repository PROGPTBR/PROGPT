import { padraoDeRelevancia } from './relevancia';
import {
  getReceitaSql,
} from './receita-db';

import {
  getCnaeByCode,
} from './cnae-lookup';

import {
  extractYear,
} from './ranking';

import type {
  GroupedSupplier,
  SearchRequest,
  SearchResponse,
  SupplierResult,
} from './types';

// ============================================================
// CONFIGURAÇÕES
// ============================================================

const DEFAULT_LIMIT = 50;

const COUNT_CAP = 500;

// Capital social a partir do qual a empresa é tratada como grande indústria ou
// holding, e não como fornecedor de uma compra comum. Achado em 2026-10-26:
// a Suzano (R$ 19 bi), registrada no CNAE de papelaria, aparecia entre as
// primeiras num pedido de papelaria em Manaus.
const CAPITAL_GRANDE = 500_000_000;

// ============================================================
// COLUNA DE DATA DE ABERTURA
// ============================================================

const OPENING_COLUMN_CANDIDATES = [
  'data_abertura',
  'data_inicio_atividade',
  'data_inicio_atividades',
  'data_de_abertura',
];

let openingColumnCache:
  | string
  | null
  | undefined;

// ============================================================
// NORMALIZAÇÃO DE CIDADE
// ============================================================
//
// A lista do IBGE retorna:
//
//   Campinas
//   Jacareí
//   São Paulo
//
// A base da Receita pode armazenar:
//
//   CAMPINAS
//   JACAREI
//   SAO PAULO
//
// Portanto normalizamos antes da comparação.
//
// Também incluímos o UF na chave:
//
//   SP|CAMPINAS
//   SP|JACAREI
//
// Isso evita conflito entre municípios com nomes iguais
// em UFs diferentes.
// ============================================================

function normalizeCityName(
  value: string,
): string {
  return value
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .trim()
    .toUpperCase();
}

// ============================================================
// DESCOBRIR COLUNA DE ABERTURA
// ============================================================

async function getOpeningColumn(
  sql: ReturnType<
    typeof getReceitaSql
  >,
): Promise<string | null> {
  if (
    openingColumnCache !==
    undefined
  ) {
    return openingColumnCache;
  }

  try {
    const rows =
      await sql<
        Array<{
          column_name: string;
        }>
      >`
        select column_name
        from information_schema.columns
        where table_name = 'empresas'
          and column_name = any(
            ${OPENING_COLUMN_CANDIDATES}::text[]
          )
        limit 1
      `;

    openingColumnCache =
      rows[0]?.column_name ??
      null;
  } catch {
    openingColumnCache =
      null;
  }

  return openingColumnCache;
}

// ============================================================
// BUSCAR FORNECEDORES
// ============================================================

export async function searchSuppliers(
  params: SearchRequest,
): Promise<SearchResponse> {
  const {
    cnae,
    ufs,
    cities,
    limit = DEFAULT_LIMIT,
    offset = 0,
    termos,
  } = params;

  // Quem tem no nome o que o comprador pediu ("papelaria") sobe na ordem.
  // Sem isso, "artigo de papelaria" trazia a Suzano no topo (21/10/2026).
  const padraoNome = padraoDeRelevancia(termos);

  const sql =
    getReceitaSql();

  // ==========================================================
  // UF
  // ==========================================================

  const ufFilter =
    ufs &&
    ufs.length > 0
      ? ufs
      : null;

  // ==========================================================
  // CIDADES
  // ==========================================================
  //
  // Exemplo:
  //
  // cities:
  // [
  //   {
  //     name: 'Campinas',
  //     uf: 'SP'
  //   },
  //   {
  //     name: 'Jacareí',
  //     uf: 'SP'
  //   }
  // ]
  //
  // vira:
  //
  // [
  //   'SP|CAMPINAS',
  //   'SP|JACAREI'
  // ]
  //
  // ==========================================================

  const cityFilter =
    cities &&
    cities.length > 0
      ? Array.from(
          new Set(
            cities.map(
              (city) =>
                `${
                  city.uf
                }|${normalizeCityName(
                  city.name,
                )}`,
            ),
          ),
        )
      : null;

  // ==========================================================
  // ABERTURA
  // ==========================================================

  const openCol =
    await getOpeningColumn(
      sql,
    );

  const openingSelect =
    openCol
      ? sql`, ${sql(
          openCol,
        )} as abertura`
      : sql``;

  const openingAgg =
    openCol
      ? sql`, min(abertura) as abertura_min`
      : sql``;

  const openingOrder =
    openCol
      ? sql`min(abertura) asc nulls last,`
      : sql``;

  // ==========================================================
  // CONSULTA
  // ==========================================================

  let groups:
    GroupedSupplier[] = [];

  let count = 0;

  try {
    // ========================================================
    // RESULTADOS
    // ========================================================
    //
    // Score:
    //
    // +100 CNAE principal
    // +150 nome tem o que foi pedido ou o nome do ramo (lib/suppliers/relevancia.ts)
    // +40  possui contato
    // +30/20/0 porte (ME / EPP / médio e grande): fornecedor pequeno sobe
    // -100 capital social acima de CAPITAL_GRANDE (grande indústria ou holding)
    //
    // Depois:
    // empresa mais antiga
    // maior capital
    // razão social
    //
    // IMPORTANTE:
    //
    // O filtro de cidades ocorre DENTRO do CTE matches.
    //
    // Isso significa que se buscarmos:
    //
    // Campinas + Jacareí
    //
    // uma empresa poderá aparecer se possuir unidade em uma
    // dessas cidades, mas `units` também conterá somente as
    // unidades que passaram pelo filtro.
    // ========================================================

    const dbRows =
      await sql<
        RawGroupRow[]
      >`
        with matches as (
          select
            cnpj,
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
            endereco,
            cep,
            ultima_atualizacao_rf,

            (
              cnae_primario =
              ${cnae}
            ) as is_primary,

            (
              telefone is not null
              or email is not null
            ) as has_contact,

            coalesce(
              ${padraoNome}::text is not null
              and translate(
                upper(
                  coalesce(razao_social, '')
                  || ' '
                  || coalesce(nome_fantasia, '')
                ),
                'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
                'AAAAAEEEEIIIIOOOOOUUUUC'
              ) ~ ${padraoNome}::text,
              false
            ) as name_match

            ${openingSelect}

          from empresas

          where (
            cnae_primario =
            ${cnae}

            or ${cnae} = any(
              coalesce(
                cnaes_secundarios,
                array[]::varchar[]
              )
            )
          )

          -- ================================================
          -- FILTRO DE ESTADO
          -- ================================================

          and (
            ${ufFilter}::text[]
            is null

            or upper(
              trim(
                coalesce(
                  uf,
                  ''
                )
              )
            ) = any(
              ${ufFilter}::text[]
            )
          )

          -- ================================================
          -- FILTRO DE CIDADE
          -- ================================================
          --
          -- Normalizamos o município da base para permitir:
          --
          -- São Paulo  -> SAO PAULO
          -- Jacareí    -> JACAREI
          -- Maceió     -> MACEIO
          --
          -- E comparamos junto com o UF:
          --
          -- SP|CAMPINAS
          --
          -- ================================================

          and (
            ${cityFilter}::text[]
            is null

            or (
              upper(
                trim(
                  coalesce(
                    uf,
                    ''
                  )
                )
              )

              || '|'

              ||

              translate(
                upper(
                  trim(
                    coalesce(
                      municipio,
                      ''
                    )
                  )
                ),
                'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
                'AAAAAEEEEIIIIOOOOOUUUUC'
              )

            ) = any(
              ${cityFilter}::text[]
            )
          )

          and situacao_cadastral =
            'ATIVA'
        )

        select
          substring(
            cnpj
            from 1
            for 8
          ) as cnpj_basico,

          json_agg(
            json_build_object(
              'cnpj',
              cnpj,

              'razao_social',
              razao_social,

              'nome_fantasia',
              nome_fantasia,

              'cnae_primario',
              cnae_primario,

              'cnaes_secundarios',
              cnaes_secundarios,

              'porte',
              porte,

              'capital_social',
              capital_social,

              'faixa_funcionarios',
              faixa_funcionarios,

              'uf',
              uf,

              'municipio',
              municipio,

              'telefone',
              telefone,

              'email',
              email,

              'endereco',
              endereco,

              'cep',
              cep,

              'ultima_atualizacao_rf',
              ultima_atualizacao_rf
            )

            order by cnpj asc
          ) as units

          ${openingAgg}

        from matches

        group by substring(
          cnpj
          from 1
          for 8
        )

        order by (
          (
            case
              when bool_or(
                is_primary
              )
              then 100
              else 0
            end
          )

          +

          -- +150 quando o nome tem o que foi pedido: pesa mais que ter o ramo
          -- como atividade principal. Quem tem "papelaria" no nome vende
          -- papelaria; a Suzano (principal no ramo, sem o termo) fica abaixo.
          (
            case
              when bool_or(
                name_match
              )
              then 150
              else 0
            end
          )

          +

          (
            case
              when bool_or(
                has_contact
              )
              then 40
              else 0
            end
          )

          +

          -- Porte: quem tem a escala de um fornecedor de compra comum sobe.
          -- Médio e grande (DEMAIS) não ganha bônus.
          (
            max(
              case porte
                when 'ME'
                  then 3
                when 'EPP'
                  then 2
                else 0
              end
            ) * 10
          )

          -

          -- Grande indústria ou holding (ex.: Suzano) desce.
          (
            case
              when max(
                capital_social::numeric
              ) > ${CAPITAL_GRANDE}::numeric
              then 100
              else 0
            end
          )
        ) desc,

        ${openingOrder}

        max(
          capital_social
        ) desc nulls last,

        min(
          razao_social
        ) asc

        limit ${limit}

        offset ${offset}
      `;

    // ========================================================
    // NORMALIZAR
    // ========================================================

    groups =
      dbRows.map(
        (row) => ({
          cnpjBasico:
            row.cnpj_basico,

          units:
            row.units.map(
              normalizeRow,
            ),

          aberturaAno:
            extractYear(
              row.abertura_min ??
                null,
            ),
        }),
      );

    // ========================================================
    // TOTAL
    // ========================================================
    //
    // O count precisa usar OS MESMOS filtros da busca.
    // Caso contrário a tela poderia mostrar:
    //
    // "500 empresas"
    //
    // mesmo que Campinas tivesse apenas 15.
    // ========================================================

    const countRows =
      await sql<
        Array<{
          total: number;
        }>
      >`
        select
          count(*)::int
          as total

        from (
          select distinct
            substring(
              cnpj
              from 1
              for 8
            ) as cnpj_basico

          from empresas

          where (
            cnae_primario =
            ${cnae}

            or ${cnae} = any(
              coalesce(
                cnaes_secundarios,
                array[]::varchar[]
              )
            )
          )

          -- ESTADO

          and (
            ${ufFilter}::text[]
            is null

            or upper(
              trim(
                coalesce(
                  uf,
                  ''
                )
              )
            ) = any(
              ${ufFilter}::text[]
            )
          )

          -- CIDADE

          and (
            ${cityFilter}::text[]
            is null

            or (
              upper(
                trim(
                  coalesce(
                    uf,
                    ''
                  )
                )
              )

              || '|'

              ||

              translate(
                upper(
                  trim(
                    coalesce(
                      municipio,
                      ''
                    )
                  )
                ),
                'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇ',
                'AAAAAEEEEIIIIOOOOOUUUUC'
              )

            ) = any(
              ${cityFilter}::text[]
            )
          )

          and situacao_cadastral =
            'ATIVA'

          limit ${COUNT_CAP}
        ) capped
      `;

    count =
      countRows[0]?.total ??
      0;
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : String(err);

    console.warn(
      '[suppliers/search] query failed:',
      msg,
    );

    groups = [];
    count = 0;
  }

  // ==========================================================
  // CNAE
  // ==========================================================

  const cnaeInfo =
    await getCnaeByCode(
      cnae,
    );

  return {
    groups,
    total: count,
    cnaeName:
      cnaeInfo?.name ??
      null,
  };
}

// ============================================================
// RAW TYPES
// ============================================================

type RawGroupRow = {
  cnpj_basico: string;

  units:
    RawEmpresaRow[];

  abertura_min?:
    | Date
    | string
    | null;
};

type RawEmpresaRow = {
  cnpj: string;

  razao_social:
    string;

  nome_fantasia:
    string | null;

  cnae_primario:
    string | null;

  cnaes_secundarios:
    string[] | null;

  porte:
    string | null;

  capital_social:
    | string
    | number
    | null;

  faixa_funcionarios:
    string | null;

  uf:
    string | null;

  municipio:
    string | null;

  telefone:
    string | null;

  email:
    string | null;

  endereco?:
    string | null;

  cep?:
    string | null;

  ultima_atualizacao_rf:
    | Date
    | string
    | null;
};

// ============================================================
// NORMALIZAR LINHA
// ============================================================

function normalizeRow(
  r: RawEmpresaRow,
): SupplierResult {
  return {
    cnpj:
      r.cnpj,

    razao_social:
      r.razao_social,

    nome_fantasia:
      r.nome_fantasia,

    cnae_primario:
      r.cnae_primario,

    cnaes_secundarios:
      r.cnaes_secundarios,

    porte:
      r.porte === 'None'
        ? null
        : r.porte,

    capital_social:
      r.capital_social ===
        null ||
      r.capital_social ===
        undefined
        ? null
        : typeof r.capital_social ===
            'number'
          ? r.capital_social
          : Number(
              r.capital_social,
            ),

    faixa_funcionarios:
      r.faixa_funcionarios,

    uf:
      r.uf?.trim() ??
      null,

    municipio:
      r.municipio,

    telefone:
      r.telefone,

    email:
      r.email,

    endereco:
      r.endereco ?? null,

    cep:
      r.cep ?? null,

    ultima_atualizacao_rf:
      r.ultima_atualizacao_rf instanceof
      Date
        ? r.ultima_atualizacao_rf
            .toISOString()
            .slice(0, 10)
        : r.ultima_atualizacao_rf,
  };
}

export {
  normalizeRow,
};