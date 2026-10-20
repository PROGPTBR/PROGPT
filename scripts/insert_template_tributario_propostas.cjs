// One-shot idempotente: grava o template padrão da Análise Tributária de
// Propostas na tabela templates (UPDATE se já existir com o mesmo nome).
// Uso: node scripts/insert_template_tributario_propostas.cjs
const fs = require('fs');
const postgres = require('postgres');

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const ADMIN_USER_ID = '5efba61c-6b36-49d1-b443-b235b003ad54'; // rgoalves@gmail.com
const NAME = 'Template padrão';
const DESCRIPTION =
  'Relatório da Análise Tributária de Propostas: resumo, custo líquido por ano, leitura de cada proposta, efeito da reforma e recomendação.';
const BODY = fs.readFileSync('docs/product/templates/tributario-propostas-padrao.md', 'utf8');

(async () => {
  const env = { ...parseEnv('.env.local'), ...process.env };
  const ref = env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '').split('.')[0];
  const sql = postgres({
    host: env.SUPABASE_POOLER_HOST || 'aws-1-us-west-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    username: `postgres.${ref}`,
    password: env.SUPABASE_DB_PASSWORD,
    ssl: 'require',
    max: 1,
    connect_timeout: 15,
  });
  try {
    const existing = await sql`select id from templates where assistant_type = 'tributario_propostas' and name = ${NAME}`;
    if (existing.length) {
      await sql`update templates set body_md = ${BODY}, description = ${DESCRIPTION}, updated_at = now() where id = ${existing[0].id}`;
      console.log('UPDATE OK', existing[0].id);
    } else {
      const [row] = await sql`insert into templates (assistant_type, name, description, body_md, created_by)
        values ('tributario_propostas', ${NAME}, ${DESCRIPTION}, ${BODY}, ${ADMIN_USER_ID}) returning id`;
      console.log('INSERT OK', row.id);
    }
    const [{ fn }] = await sql`select count(*)::int as fn from pg_proc where proname = 'modulos_desativados'`;
    console.log('função modulos_desativados presente:', fn === 1);
  } finally {
    await sql.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
