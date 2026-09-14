-- Audit log genérico pra ações administrativas — visão "Super Admin" em
-- /admin/monitor. Mesmo padrão de rate_limit_events/billing_webhook_events:
-- RLS habilitada SEM policy, então só service-role lê/escreve (nunca exposto
-- via cookie-aware client). actor_id não é FK-restritiva o bastante pra
-- travar a escrita se o profile for removido — on delete set null preserva
-- o registro histórico mesmo sem o ator mais existir.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  actor_email text,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log enable row level security;

create index if not exists audit_log_created_at_idx
  on audit_log (created_at desc);
create index if not exists audit_log_actor_idx
  on audit_log (actor_id, created_at desc);
create index if not exists audit_log_resource_idx
  on audit_log (resource_type, resource_id);
