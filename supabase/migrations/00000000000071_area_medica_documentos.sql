-- Área Médica, documentos (sub-projeto 108): o médico guarda a nota fiscal, o
-- demonstrativo do hospital, o comprovante de pagamento e o que mais precisar,
-- solto ou ligado a um recebimento.

create table if not exists medico_documentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  demonstrativo_id uuid references medico_demonstrativos(id) on delete set null,
  tipo text not null default 'outro' check (tipo in ('nota', 'demonstrativo', 'comprovante', 'pendencias', 'outro')),
  nome text not null,
  mime text not null default '',
  tamanho int not null default 0,
  caminho text not null,
  created_at timestamptz not null default now()
);
create index if not exists medico_documentos_user_idx on medico_documentos(user_id, created_at desc);

alter table medico_documentos enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'medico_documentos' and policyname = 'medico_documentos_owner') then
    create policy medico_documentos_owner on medico_documentos for select to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- Arquivos: bucket privado e SEM policy. Só o servidor lê e grava; o médico
-- baixa por um link assinado de curta duração, depois de a rota conferir o dono.
insert into storage.buckets (id, name, public, file_size_limit)
values ('medico-documentos', 'medico-documentos', false, 20971520)
on conflict (id) do nothing;
