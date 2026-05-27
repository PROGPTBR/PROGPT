-- Sub-projeto 26 — security hardening em resposta ao Supabase Advisor.
--
-- Findings cobertos:
--   ❌ 2 errors: profiles_with_email exposed a authenticated + security_definer
--      view → REVOKE SELECT FROM authenticated, anon. Service-role mantém
--      acesso (admin pages + RPC já usam service-role via getServerSupabase).
--   ⚠️ 3 warnings: search_path mutable em 3 funções admin_*.
--   ⚠️ 14 warnings: 7 funções SECURITY DEFINER com EXECUTE em PUBLIC →
--      REVOKE de public + GRANT explícito pro role correto.
--   💡 2 infos: tabelas conversations + messages criadas na migration 0000 mas
--      nunca usadas (projeto pivotou pra sessions.messages JSONB no 6b).
--      DROP CASCADE.
--
-- Não tocado nesta migration:
--   - Extension in Public (vector, pg_trgm): mover de schema quebra todas as
--     queries de retrieval. Documentado como aceito.
--   - Leaked Password Protection: toggle no Supabase Auth dashboard.

-- ────────────────────────────────────────────────────────────────────────────
-- A. Errors: profiles_with_email
-- ────────────────────────────────────────────────────────────────────────────

revoke select on profiles_with_email from authenticated, anon;
-- service_role mantém SELECT (já tinha, garantia explícita):
grant select on profiles_with_email to service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- B. Function search_path mutable (3 funções)
-- ────────────────────────────────────────────────────────────────────────────

alter function admin_top_queries(int) set search_path = public, pg_temp;
alter function admin_api_usage_by_user(int) set search_path = public, pg_temp;
alter function admin_api_usage_daily(int) set search_path = public, pg_temp;

-- ────────────────────────────────────────────────────────────────────────────
-- C. SECURITY DEFINER functions: revogar de PUBLIC + grant explícito
-- ────────────────────────────────────────────────────────────────────────────

-- admin_user_session_counts: lido só por /admin/users via getServerSupabase
revoke execute on function admin_user_session_counts() from public;
revoke execute on function admin_user_session_counts() from authenticated;
grant execute on function admin_user_session_counts() to service_role;

-- check_rate_limit: chamado pelo /api/chat via supabaseServer (authenticated role)
revoke execute on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit(text, int, int) to authenticated, service_role;

-- check_rate_limit_anon: já revogado em 0025 mas reforçando idempotente
revoke execute on function check_rate_limit_anon(text, text, int, int) from public;
revoke execute on function check_rate_limit_anon(text, text, int, int) from authenticated;
grant execute on function check_rate_limit_anon(text, text, int, int) to service_role;

-- handle_new_user: trigger function. NUNCA chamada direta. Revoga de tudo;
-- triggers rodam como owner independentemente.
revoke execute on function handle_new_user() from public;
revoke execute on function handle_new_user() from authenticated;

-- is_admin: usada em RLS policies; precisa ser executável pelo role que dispara
-- a policy. authenticated cobre signup/chat/admin; anon não pode ser admin
-- mas é seguro liberar (retorna false sem auth.uid()).
revoke execute on function is_admin() from public;
grant execute on function is_admin() to authenticated, service_role;

-- match_chunks / search_chunks_fts: chamadas pelo retrieval do /api/chat
revoke execute on function match_chunks(vector, int) from public;
grant execute on function match_chunks(vector, int) to authenticated, service_role;

revoke execute on function search_chunks_fts(text, int) from public;
grant execute on function search_chunks_fts(text, int) to authenticated, service_role;

-- ────────────────────────────────────────────────────────────────────────────
-- D. Cleanup de tabelas mortas (sub-projeto 6b pivotou pra sessions.messages)
-- ────────────────────────────────────────────────────────────────────────────

-- Zero queries no codebase referenciam essas tabelas; confirmado por grep
-- exaustivo (from('conversations'), from('messages') => 0 matches).
-- CASCADE pra remover qualquer FK / index órfão.
drop table if exists messages cascade;
drop table if exists conversations cascade;
