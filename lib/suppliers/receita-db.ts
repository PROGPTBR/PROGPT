import postgres from 'postgres';
import { requireEnv } from '@/lib/env';

// Pool dedicado para a DB Railway externa (`empresas`, `cnae_taxonomy`).
// Read-only por convenção: este módulo só expõe o `sql` tag e nada de
// UPDATE/INSERT/DELETE. As tabelas vivem em outra Postgres operada por
// outro projeto; tratamos como serviço externo (try/catch nas chamadas,
// degrade graceful em UI).
//
// Em produção (Railway) usamos `postgres.railway.internal:5432` — mesmo
// network, latência baixa, sem custo de egress. Em dev usamos o proxy
// público `yamanote.proxy.rlwy.net:28130`. A escolha vem da env
// RECEITA_DATABASE_URL.

type SqlClient = ReturnType<typeof postgres>;

let instance: SqlClient | null = null;

export function getReceitaSql(): SqlClient {
  if (instance) return instance;
  const url = requireEnv('RECEITA_DATABASE_URL');
  instance = postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 5,
    prepare: false,
  });
  return instance;
}

export async function closeReceitaPool(): Promise<void> {
  if (!instance) return;
  await instance.end({ timeout: 5 });
  instance = null;
}
