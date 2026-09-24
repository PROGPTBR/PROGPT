// Auditoria da base de fornecedores (tabela externa `empresas`).
//
// Responde, com números do banco real, as perguntas que decidem se vale
// aumentar a base:
//   1. O que temos hoje (volume, recorte, cobertura geográfica)
//   2. Quanto ocupa em disco (= custo de infra)
//   3. Quanto tempo uma busca leva de verdade
//   4. Se o caso que o cliente reclamou é falta de base OU falta de relevância
//
// Roda assim (precisa de RECEITA_DATABASE_URL no .env.local):
//   npx tsx scripts/suppliers-base-audit.ts
//
// É SOMENTE LEITURA.

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getReceitaSql, closeReceitaPool } from '../lib/suppliers/receita-db';

function fmt(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString('pt-BR');
}

async function main() {
  const sql = getReceitaSql();

  console.log('\n══ 1. VOLUME ══');
  const [tot] = await sql<Array<{ total: string; ativas: string }>>`
    select count(*)::text as total,
           count(*) filter (where situacao_cadastral = 'ATIVA')::text as ativas
    from empresas
  `;
  console.log(`  Estabelecimentos na base: ${fmt(tot?.total)}`);
  console.log(`  Com situação ATIVA (o que a busca enxerga): ${fmt(tot?.ativas)}`);

  console.log('\n══ 2. COBERTURA GEOGRÁFICA ══');
  const ufs = await sql<Array<{ uf: string; n: string }>>`
    select uf, count(*)::text as n
    from empresas
    where situacao_cadastral = 'ATIVA'
    group by uf order by count(*) desc
  `;
  console.log(`  UFs presentes: ${ufs.length} de 27`);
  for (const u of ufs.slice(0, 8)) console.log(`    ${u.uf}: ${fmt(u.n)}`);
  if (ufs.length > 8) console.log(`    … e mais ${ufs.length - 8} UFs`);

  console.log('\n══ 3. RECORTE DE ATIVIDADE ══');
  const [cnaes] = await sql<Array<{ distintos: string }>>`
    select count(distinct cnae_primario)::text as distintos
    from empresas where situacao_cadastral = 'ATIVA'
  `;
  console.log(`  CNAEs primários distintos: ${fmt(cnaes?.distintos)} (a tabela CNAE oficial tem ~1.360)`);

  console.log('\n══ 4. DISCO (= custo de infra) ══');
  const disco = await sql<Array<{ objeto: string; tamanho: string }>>`
    select 'empresas (tabela)' as objeto, pg_size_pretty(pg_table_size('empresas')) as tamanho
    union all
    select 'empresas (índices)', pg_size_pretty(pg_indexes_size('empresas'))
    union all
    select 'banco inteiro', pg_size_pretty(pg_database_size(current_database()))
  `;
  for (const d of disco) console.log(`  ${d.objeto}: ${d.tamanho}`);

  console.log('\n══ 5. TEMPO DE BUSCA (o que o usuário sente) ══');
  for (const [rotulo, cnae, uf] of [
    ['CNAE comum, estado inteiro', '4120400', 'SP'],
    ['CNAE de nicho, estado inteiro', '3811400', 'SP'],
  ] as const) {
    const t0 = Date.now();
    const [r] = await sql<Array<{ n: string }>>`
      select count(*)::text as n from empresas
      where (cnae_primario = ${cnae}
             or ${cnae} = any(coalesce(cnaes_secundarios, array[]::varchar[])))
        and uf = ${uf} and situacao_cadastral = 'ATIVA'
    `;
    console.log(`  ${rotulo} (${cnae}/${uf}): ${fmt(r?.n)} empresas em ${Date.now() - t0}ms`);
  }

  console.log('\n══ 6. O CASO DO CLIENTE: é falta de base ou de relevância? ══');
  // "locação de caçambas de entulho" → CNAE correto é 3811-4/00.
  const casos: Array<[string, string]> = [
    ['3811400', 'Coleta de resíduos não-perigosos (caçamba de entulho)'],
    ['7719599', 'Locação de outros meios de transporte (o que a IA escolheu)'],
  ];
  for (const [cnae, nome] of casos) {
    const [r] = await sql<Array<{ prim: string; sec: string }>>`
      select count(*) filter (where cnae_primario = ${cnae})::text as prim,
             count(*) filter (where cnae_primario <> ${cnae}
                                and ${cnae} = any(coalesce(cnaes_secundarios, array[]::varchar[])))::text as sec
      from empresas where uf = 'SP' and situacao_cadastral = 'ATIVA'
    `;
    console.log(`  ${cnae} — ${nome}`);
    console.log(`     SP: ${fmt(r?.prim)} como atividade PRINCIPAL · ${fmt(r?.sec)} como secundária`);
  }

  // Fornecedor local: a dor real do cliente (obras espalhadas pelo estado).
  const cidades = await sql<Array<{ municipio: string; n: string }>>`
    select municipio, count(*)::text as n
    from empresas
    where cnae_primario = '3811400' and uf = 'SP' and situacao_cadastral = 'ATIVA'
    group by municipio order by count(*) desc limit 10
  `;
  console.log('\n  Onde estão (top 10 cidades em SP, caçamba/resíduos):');
  for (const c of cidades) console.log(`     ${c.municipio}: ${fmt(c.n)}`);

  console.log('\n══ 7. CONTATABILIDADE (fornecedor sem telefone/email é inútil) ══');
  const [contato] = await sql<Array<{ com: string; total: string }>>`
    select count(*) filter (where telefone is not null or email is not null)::text as com,
           count(*)::text as total
    from empresas
    where cnae_primario = '3811400' and uf = 'SP' and situacao_cadastral = 'ATIVA'
  `;
  const pct = Number(contato?.total) > 0
    ? ((Number(contato?.com) / Number(contato?.total)) * 100).toFixed(0)
    : '0';
  console.log(`  Com telefone ou e-mail: ${fmt(contato?.com)} de ${fmt(contato?.total)} (${pct}%)`);

  await closeReceitaPool();
  console.log('');
}

main().catch(async (err) => {
  console.error('\nFALHOU:', err instanceof Error ? err.message : err);
  await closeReceitaPool().catch(() => {});
  process.exit(1);
});
