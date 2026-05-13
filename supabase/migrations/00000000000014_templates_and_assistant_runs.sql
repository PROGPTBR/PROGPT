-- Sub-projeto 20 — Assistentes (v1: RFP)
-- Two new tables to support the assistant feature:
--   1. templates — admin-curated markdown templates per assistant_type
--   2. assistant_runs — per-user execution history with output persistence

-- ─── templates ───────────────────────────────────────────────────────────
-- Admin-curated. Markdown stored inline (templates are small, ~5-50 KB);
-- no Storage bucket needed. assistant_type CHECK starts with just 'rfp' and
-- gets expanded in future sub-projetos that add new assistants.
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  assistant_type text not null check (assistant_type in ('rfp')),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  body_md text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists templates_assistant_type_idx
  on templates (assistant_type, created_at desc);

alter table templates enable row level security;

-- Authenticated users SELECT (needed to populate the template picker in the
-- form). Mutations stay service-role only — admin endpoints use
-- getServerSupabase() per the admin_write_endpoints_use_service_role memory.
create policy templates_authenticated_read on templates
  for select to authenticated using (true);

-- ─── assistant_runs ──────────────────────────────────────────────────────
-- One row per RFP/assistant invocation. status flips running → done|error in
-- the API route's onFinish callback. output_md is the source-of-truth for the
-- generated document; .docx download is rendered on-demand from this column.
create table if not exists assistant_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assistant_type text not null,
  template_id uuid references templates(id) on delete set null,
  params jsonb not null,
  output_md text,
  status text not null default 'running'
    check (status in ('running', 'done', 'error')),
  error_message text,
  trace_id text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists assistant_runs_user_idx
  on assistant_runs (user_id, created_at desc);

alter table assistant_runs enable row level security;

-- Owner-only read/insert. INSERT happens via service-role in the API route
-- (matches the rate-limit-events pattern); SELECT policy lets the docx
-- download endpoint defense-in-depth-check ownership through RLS even when
-- using service-role (the route also does an explicit owner check).
create policy assistant_runs_owner_select on assistant_runs
  for select to authenticated using (auth.uid() = user_id);

create policy assistant_runs_owner_insert on assistant_runs
  for insert to authenticated with check (auth.uid() = user_id);
