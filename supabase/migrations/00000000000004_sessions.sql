-- Sub-projeto 6b: DB-backed conversation persistence (replaces localStorage for authed users)

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sessions_user_id_updated_at_idx on sessions (user_id, updated_at desc);

alter table sessions enable row level security;

create policy sessions_owner_select on sessions for select to authenticated
  using (user_id = auth.uid());
create policy sessions_owner_insert on sessions for insert to authenticated
  with check (user_id = auth.uid());
create policy sessions_owner_update on sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sessions_owner_delete on sessions for delete to authenticated
  using (user_id = auth.uid());
