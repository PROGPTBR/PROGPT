-- Expõe auth.users.banned_until na view profiles_with_email, pra /admin/users
-- poder mostrar/gerir se a conta está ativa (login bloqueado via
-- auth.admin.updateUserById(id, { ban_duration }), não é um flag próprio).
-- CREATE OR REPLACE VIEW só aceita coluna nova no FINAL da lista — não mudar
-- a ordem das colunas existentes, senão a troca falha.
create or replace view profiles_with_email as
  select p.id, p.role, p.display_name, p.created_at,
         u.email, u.last_sign_in_at, u.created_at as auth_created_at,
         u.banned_until
    from profiles p
    join auth.users u on u.id = p.id;
