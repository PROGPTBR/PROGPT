-- Área Médica (sub-projeto 100): controle de recebíveis do médico cirurgião.
-- O hospital manda o demonstrativo das cirurgias, o contador emite a nota,
-- a nota vai para o hospital e o pagamento cai na conta. O sistema cruza o
-- demonstrativo com as cirurgias feitas e aponta o que ficou sem pagar.
--
-- Tudo é lido e gravado pelo servidor com service-role + filtro explícito de
-- user_id; a RLS fica owner-only. Nome de paciente é dado sensível: a tela
-- orienta a usar iniciais.

create table if not exists medico_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  medico_nome text not null default '',
  contador_nome text not null default '',
  contador_email text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists medico_hospitais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text not null default '',
  prazo_pagamento_dias int not null default 30 check (prazo_pagamento_dias between 0 and 365),
  exemplo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists medico_hospitais_user_idx on medico_hospitais(user_id);

create table if not exists medico_demonstrativos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid not null references medico_hospitais(id) on delete cascade,
  referencia text not null default '',
  recebido_em date not null,
  valor_total numeric(14,2) not null default 0,
  itens jsonb not null default '[]'::jsonb,
  nota_pedida_em date,
  nota_numero text not null default '',
  nota_emitida_em date,
  nota_enviada_em date,
  pago_em date,
  valor_pago numeric(14,2),
  exemplo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists medico_demonstrativos_user_idx on medico_demonstrativos(user_id, recebido_em desc);

create table if not exists medico_cirurgias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid not null references medico_hospitais(id) on delete cascade,
  data date not null,
  paciente text not null,
  procedimento text not null default '',
  convenio text not null default '',
  valor numeric(14,2),
  origem text not null default 'manual' check (origem in ('manual', 'whatsapp', 'demonstrativo')),
  demonstrativo_id uuid references medico_demonstrativos(id) on delete set null,
  cobrada_em date,
  observacao text not null default '',
  exemplo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists medico_cirurgias_user_idx on medico_cirurgias(user_id, data desc);

alter table medico_config enable row level security;
alter table medico_hospitais enable row level security;
alter table medico_demonstrativos enable row level security;
alter table medico_cirurgias enable row level security;

do $$
declare t text;
begin
  foreach t in array array['medico_config', 'medico_hospitais', 'medico_demonstrativos', 'medico_cirurgias'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_owner') then
      execute format(
        'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
        t || '_owner', t);
    end if;
  end loop;
end $$;
