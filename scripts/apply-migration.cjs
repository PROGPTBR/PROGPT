// Aplica um arquivo .sql de migration no Postgres do Supabase via o pacote
// `postgres` (Node) — alternativa ao apply_migrations.py quando não há Python
// local. Lê credenciais do .env.local (mesmo padrão do scripts/db_connect.py):
// NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD, conecta pelo pooler IPv4.
//
// Uso: node scripts/apply-migration.cjs supabase/migrations/00000000000043_*.sql
const fs = require('fs');
const postgres = require('postgres');

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

(async () => {
  const file = process.argv[2];
  if (!file) throw new Error('uso: node scripts/apply-migration.cjs <arquivo.sql>');
  const env = { ...parseEnv('.env.local'), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const pw = env.SUPABASE_DB_PASSWORD;
  if (!url || !pw) throw new Error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_DB_PASSWORD no .env.local');
  const ref = url.replace('https://', '').split('.')[0];
  const host = env.SUPABASE_POOLER_HOST || 'aws-1-us-west-2.pooler.supabase.com';

  const sql = postgres({
    host,
    port: 5432,
    database: 'postgres',
    username: `postgres.${ref}`,
    password: pw,
    ssl: 'require',
    max: 1,
    connect_timeout: 15,
  });

  const ddl = fs.readFileSync(file, 'utf8');
  try {
    await sql.unsafe(ddl); // simple protocol → aceita múltiplas statements + dollar-quoting
    console.log('OK — migration aplicada:', file);
  } finally {
    await sql.end();
  }
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
