-- Área Médica, agenda e indicações (sub-projeto 109).
--  - Agenda: a cirurgia marcada ganha a hora; na véspera o médico recebe o
--    lembrete do dia seguinte pelo WhatsApp.
--  - Indicações: o médico indica colegas (um a um ou colando uma lista de
--    contatos); a 2B Supply vê a lista para procurar cada um.

alter table medico_cirurgias add column if not exists hora text not null default '' check (hora = '' or hora ~ '^[0-2][0-9]:[0-5][0-9]$');

alter table medico_config
  add column if not exists lembretes_agenda boolean not null default true,
  add column if not exists ultimo_lembrete_em date;

create table if not exists medico_indicacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  contato text not null,
  especialidade text not null default '',
  -- Acompanhamento pela 2B Supply.
  situacao text not null default 'nova' check (situacao in ('nova', 'em_contato', 'virou_cliente', 'sem_interesse')),
  created_at timestamptz not null default now(),
  unique (user_id, contato)
);
create index if not exists medico_indicacoes_user_idx on medico_indicacoes(user_id, created_at desc);

alter table medico_indicacoes enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'medico_indicacoes' and policyname = 'medico_indicacoes_owner') then
    create policy medico_indicacoes_owner on medico_indicacoes for select to authenticated using (user_id = auth.uid());
  end if;
end $$;
