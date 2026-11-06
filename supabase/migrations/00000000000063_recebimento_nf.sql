-- Recebimento de NF (sub-projeto 95): o pedido de compra (PO) é a referência.
-- O fornecedor anexa a nota por um link (sem conta), o sistema separa a nota
-- de ENTREGA (almoxarifado, sem valores) da nota FINANCEIRA (financeiro),
-- confere cada uma contra o pedido, aceita entrega parcial com pendência e
-- só libera o pagamento depois do OK do almoxarifado.
--
-- Os três links públicos (fornecedor, almoxarifado, financeiro) usam tokens
-- de 32 bytes: o token é a credencial. Tudo é lido e gravado pelo servidor
-- com service-role + filtro explícito de user_id; a RLS fica owner-only.

create table if not exists recebimento_pedidos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero text not null default '',
  titulo text not null default '',
  fornecedor_nome text not null,
  fornecedor_cnpj text not null default '',
  fornecedor_email text not null default '',
  almoxarifado_nome text not null default '',
  almoxarifado_email text not null default '',
  financeiro_nome text not null default '',
  financeiro_email text not null default '',
  condicoes text not null default '',
  itens jsonb not null default '[]'::jsonb,
  valor_total numeric(14,2) not null default 0,
  -- Derivado das notas e entradas (lib/recebimento/conferencia.ts statusDoPedido).
  status text not null default 'aguardando_nota',
  fornecedor_token text not null unique,
  almoxarifado_token text not null unique,
  financeiro_token text not null unique,
  pagamento_liberado_em timestamptz,
  pagamento_liberado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recebimento_pedidos_user_idx
  on recebimento_pedidos(user_id, updated_at desc);

create table if not exists recebimento_notas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references recebimento_pedidos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  finalidade text not null check (finalidade in ('entrega', 'financeira', 'unica')),
  numero text not null default '',
  serie text not null default '',
  chave text not null default '',
  emitente_nome text not null default '',
  emitente_cnpj text not null default '',
  data_emissao text not null default '',
  natureza text not null default '',
  valor_total numeric(14,2),
  itens jsonb not null default '[]'::jsonb,
  origem text not null check (origem in ('xml', 'pdf')),
  enviado_por text not null check (enviado_por in ('fornecedor', 'comprador')),
  conferencia jsonb not null default '{}'::jsonb,
  arquivo_nome text not null default '',
  arquivo_path text,
  created_at timestamptz not null default now()
);

create index if not exists recebimento_notas_pedido_idx
  on recebimento_notas(pedido_id, created_at);

-- Cada conferência física do almoxarifado (pode haver várias: entrega parcial).
create table if not exists recebimento_entradas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references recebimento_pedidos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nota_id uuid references recebimento_notas(id) on delete set null,
  itens jsonb not null default '[]'::jsonb,
  responsavel text not null default '',
  observacao text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists recebimento_entradas_pedido_idx
  on recebimento_entradas(pedido_id, created_at);

alter table recebimento_pedidos enable row level security;
alter table recebimento_notas enable row level security;
alter table recebimento_entradas enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='recebimento_pedidos' and policyname='recebimento_pedidos_owner') then
    create policy recebimento_pedidos_owner on recebimento_pedidos
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='recebimento_notas' and policyname='recebimento_notas_owner') then
    create policy recebimento_notas_owner on recebimento_notas
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='recebimento_entradas' and policyname='recebimento_entradas_owner') then
    create policy recebimento_entradas_owner on recebimento_entradas
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Arquivos das notas (XML e PDF). Privado e SEM policy: só o servidor
-- (service-role) lê e grava; o download passa por rota que confere o dono
-- ou o token do financeiro.
insert into storage.buckets (id, name, public, file_size_limit)
values ('recebimento-notas', 'recebimento-notas', false, 15728640)
on conflict (id) do nothing;

comment on table recebimento_pedidos is
  'Pedidos de compra acompanhados no Recebimento de NF (fornecedor anexa a nota, almoxarifado confere, financeiro paga).';
