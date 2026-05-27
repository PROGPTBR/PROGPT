-- Sub-projeto 25: pre-auth rate-limit pra endpoints públicos (/api/auth/signup,
-- /api/auth/reset-request).
--
-- O check_rate_limit existente (sub-projeto 8) usa auth.uid() interno e só
-- funciona pra requests autenticados. Aqui replicamos a estrutura com chave =
-- ip_hash (sha256(ip + APP_SECRET)) pra cobrir abuse pré-signup.
--
-- IP **nunca é armazenado cru** — só o hash com salt. Rotacionar APP_SECRET
-- invalida o tracking pré-existente, o que é OK pra emergência.

create table rate_limit_events_anon (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_anon_lookup
  on rate_limit_events_anon(ip_hash, endpoint, created_at desc);

alter table rate_limit_events_anon enable row level security;
-- Sem policies: RLS-on + 0 policies = zero acesso direto. Só a RPC
-- security-definer abaixo lê/escreve.

create or replace function check_rate_limit_anon(
  p_ip_hash text,
  p_endpoint text,
  p_per_min int,
  p_per_hour int
)
returns table(allowed boolean, retry_after_secs int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_count int;
  v_hour_count int;
begin
  if p_ip_hash is null or p_ip_hash = '' then
    -- Sem IP utilizável (dev local ou proxy bugado) — sempre permitir;
    -- captcha cobre o caso. Não conta como hit.
    return query select true, 0;
    return;
  end if;

  select count(*) into v_min_count from rate_limit_events_anon
    where ip_hash = p_ip_hash
      and endpoint = p_endpoint
      and created_at > now() - interval '1 minute';

  select count(*) into v_hour_count from rate_limit_events_anon
    where ip_hash = p_ip_hash
      and endpoint = p_endpoint
      and created_at > now() - interval '1 hour';

  if v_min_count >= p_per_min then
    return query select false, 60;
    return;
  end if;

  if v_hour_count >= p_per_hour then
    return query select false, 3600;
    return;
  end if;

  insert into rate_limit_events_anon(ip_hash, endpoint) values (p_ip_hash, p_endpoint);

  -- Cleanup probabilístico (~1% das calls) mantém a tabela enxuta sem pg_cron.
  if random() < 0.01 then
    delete from rate_limit_events_anon where created_at < now() - interval '2 hour';
  end if;

  return query select true, 0;
end$$;

revoke all on function check_rate_limit_anon(text, text, int, int) from public;
-- service-role precisa executar; "anon" e "authenticated" não usam direto
-- (a chamada sempre vem via getServerSupabase() do server).
grant execute on function check_rate_limit_anon(text, text, int, int) to service_role;
