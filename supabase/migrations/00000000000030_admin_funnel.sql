-- #8 go-live — dashboard interno de funil de validação (B2C launch).
--
-- Função read-only agregando o funil signup → ativação → pago + uso por
-- assistente, a partir de profiles/assistant_runs/sessions/subscriptions.
-- É o "motor de validação": decide qual assistente construir a seguir
-- com dado real, não palpite de roadmap.
--
-- SECURITY DEFINER + search_path travado + EXECUTE só pra service_role
-- (mesmo hardening da migration 0026). A rota /api/admin/funnel chama via
-- service-role após requireAdmin().

create or replace function admin_funnel_metrics()
returns json
language sql
security definer
set search_path = public, pg_temp
as $$
  select json_build_object(
    'signups_total',  (select count(*) from profiles),
    'signups_7d',     (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'signups_30d',    (select count(*) from profiles where created_at >= now() - interval '30 days'),
    -- Ativação = usou QUALQUER coisa (chat OU assistente)
    'activated_total', (
      select count(distinct uid) from (
        select user_id as uid from assistant_runs
        union
        select user_id as uid from sessions
      ) u
    ),
    'activated_assistants', (select count(distinct user_id) from assistant_runs),
    'activated_chat',       (select count(distinct user_id) from sessions),
    -- Conversão paga (admin não tem subscription; contamos só pagantes reais)
    'paid_active',    (select count(*) from subscriptions where status in ('active', 'past_due')),
    'paid_cancelled', (select count(*) from subscriptions where status in ('cancelled', 'expired')),
    -- Uso por assistente — qual está sendo de fato usado
    'by_assistant', (
      select coalesce(json_agg(row_to_json(t) order by t.runs desc), '[]'::json)
      from (
        select
          assistant_type,
          count(*)                              as runs,
          count(distinct user_id)               as distinct_users,
          count(*) filter (where status = 'done')  as done,
          count(*) filter (where status = 'error') as errored
        from assistant_runs
        group by assistant_type
      ) t
    )
  );
$$;

revoke execute on function admin_funnel_metrics() from public;
grant execute on function admin_funnel_metrics() to service_role;
