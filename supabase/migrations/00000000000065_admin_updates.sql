-- Sub-projeto 65: gestão e publicação das atualizações do PROGPT.
-- A tabela fica exposta ao Data API apenas para a leitura controlada por RLS;
-- a aplicação administrativa ainda faz mutações via service-role depois de
-- requireAdmin(), seguindo o padrão do projeto.

create table public.product_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  slug text not null unique check (
    char_length(slug) between 1 and 160
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  category text not null check (category in ('new_feature', 'improvement', 'fix')),
  summary text not null check (char_length(summary) between 1 and 600),
  content_md text not null default '' check (char_length(content_md) <= 50000),
  image_url text check (image_url is null or char_length(image_url) <= 2048),
  video_url text check (video_url is null or char_length(video_url) <= 2048),
  media_caption text check (media_caption is null or char_length(media_caption) <= 240),
  published_at timestamptz not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_updates_publication_idx
  on public.product_updates (published_at desc)
  where status = 'published';

create or replace function public.set_product_updates_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger product_updates_set_updated_at
  before update on public.product_updates
  for each row execute function public.set_product_updates_updated_at();

revoke execute on function public.set_product_updates_updated_at() from public;

alter table public.product_updates enable row level security;

-- Grants e RLS são camadas independentes. O público só precisa de SELECT;
-- admins autenticados também recebem os verbos usados pelas policies abaixo.
revoke all on table public.product_updates from anon, authenticated;
grant select on table public.product_updates to anon, authenticated;
grant insert, update, delete on table public.product_updates to authenticated;
grant all on table public.product_updates to service_role;

create policy product_updates_public_read
  on public.product_updates
  for select
  to anon, authenticated
  using (status = 'published' and published_at <= now());

create policy product_updates_admin_read
  on public.product_updates
  for select
  to authenticated
  using ((select public.is_admin()));

create policy product_updates_admin_insert
  on public.product_updates
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy product_updates_admin_update
  on public.product_updates
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy product_updates_admin_delete
  on public.product_updates
  for delete
  to authenticated
  using ((select public.is_admin()));

-- Conteúdo que estava fixo em app/atualizacoes/UpdatesPage.tsx. ON CONFLICT
-- torna o seed idempotente e DO NOTHING preserva eventuais edições posteriores.
insert into public.product_updates (
  title,
  slug,
  category,
  summary,
  content_md,
  video_url,
  media_caption,
  published_at,
  status
)
values (
  'Encontre seus assistentes com mais facilidade',
  'busca-de-assistentes',
  'new_feature',
  'Agora você pode buscar assistentes diretamente no menu lateral da área de chat. Abra Assistentes e digite o nome do assistente que deseja encontrar para acessá-lo mais rapidamente.',
  '- Confira no vídeo abaixo, a nova atualização',
  '/atualizacoes/busca-assistentes.mp4',
  'Busca de assistentes • demonstração em vídeo',
  '2026-10-30 12:00:00-03'::timestamptz,
  'published'
)
on conflict (slug) do nothing;
