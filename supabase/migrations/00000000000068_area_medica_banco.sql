-- Área Médica, banco (sub-projeto 102): ligação com o BTG Empresas. O médico
-- autoriza a leitura da conta (OAuth do BTG Id) e o banco avisa cada crédito
-- e débito por webhook. O sistema contabiliza o que entra e o que sai e marca
-- sozinho o pagamento das notas.

create table if not exists medico_banco (
  user_id uuid primary key references auth.users(id) on delete cascade,
  banco text not null default 'btg' check (banco in ('btg')),
  -- CNPJ da conta (só dígitos). Único: o aviso do banco chega pelo CNPJ, e
  -- duas pessoas com o mesmo CNPJ receberiam o extrato uma da outra.
  cnpj text not null unique check (cnpj ~ '^[0-9]{14}$'),
  -- Refresh token cifrado (AES-256-GCM, chave derivada de APP_SECRET).
  refresh_token_cifrado text not null,
  renovado_em timestamptz not null default now(),
  conectado_em timestamptz not null default now(),
  -- Preenchido quando a renovação falha: o médico precisa autorizar de novo.
  erro text not null default ''
);

create table if not exists medico_movimentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origem text not null default 'btg',
  transacao_id text not null,
  data timestamptz not null,
  sentido text not null check (sentido in ('entrada', 'saida')),
  valor numeric(14,2) not null check (valor >= 0),
  forma text not null default '',
  descricao text not null default '',
  contraparte text not null default '',
  -- Nota (demonstrativo ou cobrança direta) que este crédito pagou.
  demonstrativo_id uuid references medico_demonstrativos(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, origem, transacao_id, sentido)
);
create index if not exists medico_movimentos_user_idx on medico_movimentos(user_id, data desc);

alter table medico_banco enable row level security;
alter table medico_movimentos enable row level security;
-- medico_banco fica SEM policy: guarda credencial, só o servidor lê.
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'medico_movimentos' and policyname = 'medico_movimentos_owner') then
    create policy medico_movimentos_owner on medico_movimentos for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
