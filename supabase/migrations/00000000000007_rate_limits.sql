-- Sub-projeto 8: per-user sliding-window rate limit for /api/chat.
-- Backed by an INSERT-counted events table; lookups via a security-definer RPC
-- so the table itself stays inaccessible to clients.

create table rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_lookup
  on rate_limit_events(user_id, endpoint, created_at desc);

alter table rate_limit_events enable row level security;
-- No policies are intentionally added: RLS-on with no policies => zero
-- direct access for any role. Only the security-definer RPC below reads/writes.

create or replace function check_rate_limit(
  p_endpoint text,
  p_per_min int,
  p_per_hour int
)
returns table(allowed boolean, retry_after_secs int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_min_count int;
  v_hour_count int;
begin
  if v_user is null then
    return query select false, 60;
    return;
  end if;

  select count(*) into v_min_count from rate_limit_events
    where user_id = v_user
      and endpoint = p_endpoint
      and created_at > now() - interval '1 minute';

  select count(*) into v_hour_count from rate_limit_events
    where user_id = v_user
      and endpoint = p_endpoint
      and created_at > now() - interval '1 hour';

  if v_min_count >= p_per_min then
    return query select false, 60;
    return;
  end if;

  if v_hour_count >= p_per_hour then
    return query select false, 3600;
    return;
  end if;

  insert into rate_limit_events(user_id, endpoint) values (v_user, p_endpoint);

  -- Probabilistic cleanup (~1% of calls) keeps the table small without pg_cron.
  if random() < 0.01 then
    delete from rate_limit_events where created_at < now() - interval '2 hour';
  end if;

  return query select true, 0;
end$$;

revoke all on function check_rate_limit(text, int, int) from public;
grant execute on function check_rate_limit(text, int, int) to authenticated;
