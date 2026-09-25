-- Cobblemon LivingDex V1.4 Daily Streak migration
-- Run once in Supabase SQL Editor.
-- Daily streak is stored inside player_saves.training.__daily by the frontend.

drop view if exists public.leaderboard;

create view public.leaderboard
as
select
  p.id,
  p.display_name,
  p.dex_name,
  p.favorite_pokemon,
  p.favorite_type,
  p.favorite_region,
  p.favorite_generation,
  coalesce((
    select count(*) from jsonb_object_keys(s.state) as caught(id)
    where (s.state -> caught.id)::boolean = true
  ), 0)::integer as caught_count,
  coalesce((
    select count(*) from jsonb_object_keys(s.favorites) as fav(id)
    where (s.favorites -> fav.id)::boolean = true
  ), 0)::integer as favorite_count,
  coalesce((
    select max((v ->> 'best')::integer)
    from jsonb_each(s.training) as t(k, v)
    where k <> '__settings' and k <> '__daily' and jsonb_typeof(v) = 'object' and (v ? 'best')
  ), 0) as best_training_score,
  coalesce((
    select max(case when coalesce((v ->> 'questions')::numeric, 0) > 0 then ((v ->> 'correct')::numeric / (v ->> 'questions')::numeric) * 100 else 0 end)
    from jsonb_each(s.training) as t(k, v)
    where k <> '__settings' and k <> '__daily' and jsonb_typeof(v) = 'object' and (v ? 'questions') and (v ? 'correct')
  ), 0) as best_training_accuracy,
  coalesce((s.training -> '__daily' ->> 'streak')::integer, 0) as daily_streak,
  coalesce((s.training -> '__daily' ->> 'bestStreak')::integer, 0) as best_daily_streak,
  s.updated_at
from public.profiles p
join public.player_saves s on s.user_id = p.id
where p.show_profile = true and p.show_on_leaderboard = true;

grant select on public.leaderboard to anon, authenticated;
