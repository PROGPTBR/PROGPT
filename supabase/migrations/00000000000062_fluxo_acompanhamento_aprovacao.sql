-- Fluxo de Compras, Fase 1 (sub-projeto 90): acompanhamento pelo solicitante
-- e aprovação do gestor por e-mail.
--
-- (a) fluxo_processos ganha o token do link público de acompanhamento e o
--     contato de quem pediu a compra (recebe e-mail a cada etapa).
-- (b) fluxo_aprovacoes: pedido de aprovação de UMA execução de etapa,
--     enviado a um gestor que não precisa ter conta. O token do link é a
--     credencial (32 bytes aleatórios, uso único, com validade).
--
-- Tudo é lido e gravado pelo servidor com service-role. A RLS fica
-- owner-only, como nas demais tabelas do Fluxo.

alter table fluxo_processos add column if not exists acompanhamento_token text;
alter table fluxo_processos add column if not exists solicitante_nome text;
alter table fluxo_processos add column if not exists solicitante_email text;

create unique index if not exists fluxo_processos_acompanhamento_token_idx
  on fluxo_processos(acompanhamento_token)
  where acompanhamento_token is not null;

create table if not exists fluxo_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null references fluxo_processos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  etapa text not null,
  -- A execução (fluxo_etapas) que o gestor está aprovando. Se o comprador
  -- decidir antes, ou a etapa for refeita, o pedido deixa de valer.
  etapa_execucao_id uuid not null references fluxo_etapas(id) on delete cascade,
  aprovador_nome text not null default '',
  aprovador_email text not null,
  token text not null unique,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'reprovado', 'cancelado')),
  comentario text,
  expira_em timestamptz not null default (now() + interval '14 days'),
  decidido_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fluxo_aprovacoes_processo_idx
  on fluxo_aprovacoes(processo_id, created_at);

alter table fluxo_aprovacoes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='fluxo_aprovacoes' and policyname='fluxo_aprovacoes_owner') then
    create policy fluxo_aprovacoes_owner on fluxo_aprovacoes
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

comment on table fluxo_aprovacoes is
  'Pedidos de aprovação de etapa do Fluxo enviados por e-mail a um gestor sem conta.';
