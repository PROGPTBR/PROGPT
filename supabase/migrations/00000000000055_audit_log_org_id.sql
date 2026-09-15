-- Fundação "Plataforma" (parte 3) — audit_log ganha org_id.
--
-- Reusa a tabela de auditoria do sub-projeto 54 (visão Super Admin) em vez
-- de criar uma nova — as ações administrativas de /plataforma (criar org,
-- promover/rebaixar super_admin, mover usuário de org, CRUD de
-- plataforma_templates) são logadas ali junto com as de /admin. org_id é
-- nullable: ações que não são sobre uma org específica (ex.: CRUD de
-- plataforma_templates, que é cross-org por natureza) deixam null.

alter table audit_log add column if not exists org_id uuid references orgs(id) on delete set null;

create index if not exists audit_log_org_idx on audit_log (org_id, created_at desc);
