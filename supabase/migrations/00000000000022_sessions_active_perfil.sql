-- Sub-projeto 34 — Perfil da Categoria ativo no chat
--
-- sessions ganha active_perfil_id apontando para um assistant_runs row
-- com assistant_type='profile' (não constrangido a esse nível porque o
-- assistant_type não tem CHECK constraint próprio; a validação fica no
-- /api/chat). ON DELETE SET NULL para que deletar um Perfil não derrube
-- o histórico do chat — só desliga a categoria ativa.

alter table sessions
  add column if not exists active_perfil_id uuid
    references assistant_runs(id) on delete set null;
