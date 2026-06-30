-- Proc2Pay — orquestrador Source-to-Pay (Fase 1).
--
-- Um "processo de compra" com estado que encadeia os assistentes existentes:
-- nasce na requisição (e-mail/formulário) e percorre as etapas carregando o
-- contexto adiante, até a emissão e envio da PO ao fornecedor.
--
-- Modelo de dados próprio (NÃO é assistant_runs): processo + execuções de etapa
-- + aprovação. Tudo USER-scoped (RLS owner-only, igual comprador_quotes /
-- sessions) — NÃO copiar is_admin(). Filhos carregam user_id denormalizado p/
-- RLS direta (padrão de comprador_replies). Spec:
-- docs/superpowers/specs/2026-06-29-proc2pay-design.md

-- Processo de compra (o registro-mãe, máquina de estados) ---------------------
create table if not exists proc2pay_processes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero text not null,                       -- "PC-2026-000123" legível
  titulo text not null default 'Processo de compra',
  status text not null default 'requisicao',  -- etapa corrente (id da etapa)
  state text not null default 'em_andamento'
    check (state in ('em_andamento', 'concluido', 'cancelado')),
  origem text not null default 'manual'
    check (origem in ('email', 'manual', 'exemplo')),
  requisicao jsonb not null default '{}'::jsonb,  -- payload estruturado da requisição
  context jsonb not null default '{}'::jsonb,     -- acumulador de saídas por etapa (handoff)
  is_example boolean not null default false,      -- a "tela de exemplo"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proc2pay_processes_user_idx
  on proc2pay_processes(user_id, created_at desc);
create unique index if not exists proc2pay_processes_user_numero_idx
  on proc2pay_processes(user_id, numero);

alter table proc2pay_processes enable row level security;
drop policy if exists proc2pay_processes_own on proc2pay_processes;
create policy proc2pay_processes_own on proc2pay_processes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Execução de etapa (1 linha por vez que uma etapa roda) ----------------------
create table if not exists proc2pay_stage_runs (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references proc2pay_processes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,                        -- requisicao | estrategia | rfq_rfp | ...
  assistant_run_id uuid references assistant_runs(id) on delete set null,
  status text not null default 'pendente'
    check (status in ('pendente', 'em_andamento', 'concluido', 'pulado', 'erro')),
  input jsonb,                                -- entrada montada do context
  output jsonb,                               -- saída normalizada (volta pro context)
  artifact_md text,                           -- narrativa/markdown da etapa (se houver)
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists proc2pay_stage_runs_process_idx
  on proc2pay_stage_runs(process_id, created_at desc);

alter table proc2pay_stage_runs enable row level security;
drop policy if exists proc2pay_stage_runs_own on proc2pay_stage_runs;
create policy proc2pay_stage_runs_own on proc2pay_stage_runs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aprovação (passo 12 — 1 aprovador na v1) ------------------------------------
create table if not exists proc2pay_approvals (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references proc2pay_processes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  approver_id uuid references auth.users(id) on delete set null,
  decision text not null check (decision in ('aprovado', 'reprovado')),
  comment text,
  decided_at timestamptz not null default now()
);
create index if not exists proc2pay_approvals_process_idx
  on proc2pay_approvals(process_id, decided_at desc);

alter table proc2pay_approvals enable row level security;
drop policy if exists proc2pay_approvals_own on proc2pay_approvals;
create policy proc2pay_approvals_own on proc2pay_approvals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
