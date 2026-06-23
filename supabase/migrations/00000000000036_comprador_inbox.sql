-- Robô Comprador — Caixa de Cotações (persistência + respostas com aprovação).
--
-- v1 (núcleo): cotações salvas + rascunho de resposta ao fornecedor que passa
-- pela aprovação do cliente antes de enviar (via Resend). Intake manual/forward
-- por enquanto; o inbound automático (webhook Resend) usa `source='email'` numa
-- leva futura. RLS owner-only.

-- Cotações (uma análise/thread de propostas) ---------------------------------
create table if not exists comprador_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Cotação',
  supplier_name text,
  supplier_email text,
  escopo text not null default '',
  propostas text not null default '',
  politica text not null default '',
  analysis jsonb,                       -- CompradorResult (ranking/TCO/PO/HITL)
  severidade text,                      -- info|warn|danger (do analysis, p/ filtro)
  status text not null default 'analyzed'
    check (status in ('analyzing', 'analyzed', 'awaiting_reply', 'replied', 'closed')),
  source text not null default 'manual'
    check (source in ('manual', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comprador_quotes_user_idx
  on comprador_quotes(user_id, created_at desc);

alter table comprador_quotes enable row level security;
drop policy if exists comprador_quotes_own on comprador_quotes;
create policy comprador_quotes_own on comprador_quotes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Respostas rascunhadas ao fornecedor (aprovação obrigatória) -----------------
create table if not exists comprador_replies (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references comprador_quotes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  to_email text,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'sent', 'discarded')),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists comprador_replies_quote_idx
  on comprador_replies(quote_id, created_at desc);

alter table comprador_replies enable row level security;
drop policy if exists comprador_replies_own on comprador_replies;
create policy comprador_replies_own on comprador_replies
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Config do robô por usuário --------------------------------------------------
create table if not exists comprador_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tone text not null default 'cordial',   -- cordial|formal|firme
  rules text not null default '',          -- regras do cliente (texto livre)
  signature text not null default '',
  approval_required boolean not null default true,
  auto_draft boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table comprador_settings enable row level security;
drop policy if exists comprador_settings_own on comprador_settings;
create policy comprador_settings_own on comprador_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
