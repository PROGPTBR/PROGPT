-- Área Médica, integrações (sub-projeto 101): WhatsApp do médico (Evolution
-- API), e-mail automático (envio e recebimento), cobrança direta ao paciente
-- (quem recebe e emite a nota na hora, como o anestesista), avisos fora da
-- tela e conferência do extrato do banco.

alter table medico_config
  add column if not exists medico_email text not null default '',
  add column if not exists whatsapp_numero text not null default '',
  add column if not exists chave_pix text not null default '',
  add column if not exists avisos_email boolean not null default true,
  add column if not exists avisos_whatsapp boolean not null default true,
  add column if not exists grupo_jid text not null default '',
  add column if not exists grupo_nome text not null default '',
  add column if not exists ultimo_aviso_em date;

-- tipo 'direto': quem paga é o paciente, na hora (um procedimento só).
alter table medico_demonstrativos
  add column if not exists tipo text not null default 'hospital' check (tipo in ('hospital', 'direto')),
  add column if not exists pagador_nome text not null default '',
  add column if not exists pagador_documento text not null default '',
  add column if not exists pagador_contato text not null default '';

-- Caixa de entrada: o que chegou sozinho (mensagem do grupo de WhatsApp,
-- e-mail encaminhado do hospital) e ainda espera a conferência do médico.
create table if not exists medico_entradas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  canal text not null check (canal in ('whatsapp', 'email')),
  -- id da mensagem na origem, para não gravar duas vezes a mesma entrega.
  origem_id text not null,
  remetente text not null default '',
  assunto text not null default '',
  texto text not null,
  recebido_em timestamptz not null default now(),
  tratado_em timestamptz,
  unique (user_id, canal, origem_id)
);
create index if not exists medico_entradas_abertas_idx on medico_entradas(user_id, canal, recebido_em) where tratado_em is null;

alter table medico_entradas enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'medico_entradas' and policyname = 'medico_entradas_owner') then
    create policy medico_entradas_owner on medico_entradas for all to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
