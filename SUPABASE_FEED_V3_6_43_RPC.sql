-- Feed fix: expose only opted-in public activity through a SECURITY DEFINER RPC.
-- This avoids exposing player_saves directly through player_public_stats, which is
-- blocked by the existing owner-only RLS policy on player_saves.
create or replace function public.get_global_activity()
returns table (
  id text,
  ts bigint,
  date text,
  type text,
  entry_id text,
  name text,
  entry_name text,
  trainer_name text,
  activity_user_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    a->>'id' as id,
    case when (a->>'ts') ~ '^[0-9]+$' then (a->>'ts')::bigint else null end as ts,
    a->>'date' as date,
    a->>'type' as type,
    coalesce(a->>'entryId', a->>'entry_id') as entry_id,
    coalesce(a->>'name', a->>'entryName') as name,
    coalesce(a->>'entryName', a->>'name') as entry_name,
    coalesce(p.display_name, 'Trainer') as trainer_name,
    p.id as activity_user_id
  from profiles p
  join player_saves s on s.user_id = p.id
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(s.training->'__activity') = 'array'
      then s.training->'__activity'
      else '[]'::jsonb
    end
  ) a
  where p.show_profile = true
    and p.show_in_players = true
    and coalesce(a->>'type','') not in ('team_add','team_remove')
  order by case when (a->>'ts') ~ '^[0-9]+$' then (a->>'ts')::bigint else 0 end desc
  limit 100;
$$;

revoke all on function public.get_global_activity() from public;
grant execute on function public.get_global_activity() to anon, authenticated;
