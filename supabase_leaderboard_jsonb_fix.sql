-- V2.0.23 — robust leaderboard view for legacy boolean + numeric JSONB state values
-- Run as a NEW query in Supabase SQL Editor. Do not replace older migrations.

create or replace view public.leaderboard as
select
  p.id,
  p.display_name,
  p.dex_name,
  p.favorite_pokemon,
  p.favorite_type,
  p.favorite_region,
  p.favorite_generation,
  coalesce((
    select count(*)
    from jsonb_object_keys(coalesce(s.state, '{}'::jsonb)) as caught(id)
    where (jsonb_typeof(s.state -> caught.id) = 'boolean' and (s.state ->> caught.id)::boolean = true)
       or (jsonb_typeof(s.state -> caught.id) = 'number' and coalesce((s.state ->> caught.id)::numeric,0) > 0)
       or (jsonb_typeof(s.state -> caught.id) = 'string' and lower(s.state ->> caught.id) in ('true','1'))
  ),0)::integer as caught_count,
  coalesce((
    select count(*)
    from jsonb_object_keys(coalesce(s.favorites, '{}'::jsonb)) as fav(id)
    where (jsonb_typeof(s.favorites -> fav.id) = 'boolean' and (s.favorites ->> fav.id)::boolean = true)
       or (jsonb_typeof(s.favorites -> fav.id) = 'number' and coalesce((s.favorites ->> fav.id)::numeric,0) > 0)
       or (jsonb_typeof(s.favorites -> fav.id) = 'string' and lower(s.favorites ->> fav.id) in ('true','1'))
  ),0)::integer as favorite_count,
  coalesce((
    select max((v ->> 'best')::integer)
    from jsonb_each(coalesce(s.training, '{}'::jsonb)) as t(k,v)
    where k <> '__settings' and k <> '__daily' and jsonb_typeof(v) = 'object' and (v ? 'best') and (v ->> 'best') ~ '^-?[0-9]+$'
  ),0) as best_training_score,
  coalesce((
    select max(case when coalesce((v ->> 'questions')::numeric,0) > 0 then ((v ->> 'correct')::numeric / (v ->> 'questions')::numeric) * 100 else 0 end)
    from jsonb_each(coalesce(s.training, '{}'::jsonb)) as t(k,v)
    where k <> '__settings' and k <> '__daily' and jsonb_typeof(v) = 'object' and (v ? 'questions') and (v ? 'correct')
  ),0) as best_training_accuracy,
  coalesce((s.training -> '__daily' ->> 'streak')::integer,0) as daily_streak,
  coalesce((s.training -> '__daily' ->> 'bestStreak')::integer,0) as best_daily_streak,
  s.updated_at
from public.profiles p
join public.player_saves s on s.user_id=p.id
where p.show_profile=true and p.show_on_leaderboard=true;

grant select on public.leaderboard to anon, authenticated;
