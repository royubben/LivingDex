-- Cobblemon LivingDex V1.2
-- Run this entire file in the Supabase SQL Editor.
-- This schema is designed for the GitHub Pages frontend.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Trainer',
  dex_name text not null default 'Dex',
  favorite_pokemon text,
  favorite_type text,
  favorite_region text,
  favorite_generation integer,
  bio text,
  show_profile boolean not null default true,
  show_in_players boolean not null default true,
  show_on_leaderboard boolean not null default true,
  show_team boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_saves (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  favorites jsonb not null default '{}'::jsonb,
  notes jsonb not null default '{}'::jsonb,
  team jsonb not null default '[]'::jsonb,
  training jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  insert into public.player_saves (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.player_saves enable row level security;

revoke all on public.profiles from anon;
revoke all on public.player_saves from anon;
grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.player_saves to authenticated;

-- Public profile discovery only exposes profiles that opted in.
drop policy if exists "Public opted-in profiles are visible" on public.profiles;
create policy "Public opted-in profiles are visible"
on public.profiles for select
to anon, authenticated
using (show_profile = true and show_in_players = true);

-- A signed-in player can manage their own profile.
drop policy if exists "Users can manage own profile" on public.profiles;
create policy "Users can manage own profile"
on public.profiles for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Saves are private: only the owner can read/write their own save.
drop policy if exists "Users can manage own save" on public.player_saves;
create policy "Users can manage own save"
on public.player_saves for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Safe public leaderboard view. It exposes objective progress only for opted-in users.
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
    select count(*)
    from jsonb_object_keys(s.state) as caught(id)
    where (s.state -> caught.id)::boolean = true
  ), 0)::integer as caught_count,
  coalesce((
    select count(*)
    from jsonb_object_keys(s.favorites) as fav(id)
    where (s.favorites -> fav.id)::boolean = true
  ), 0)::integer as favorite_count,
  coalesce((s.training ->> 'bestScore')::integer, 0) as best_training_score,
  coalesce((s.training ->> 'bestAccuracy')::numeric, 0) as best_training_accuracy,
  coalesce((s.training ->> 'streak')::integer, 0) as training_streak,
  s.updated_at
from public.profiles p
join public.player_saves s on s.user_id = p.id
where p.show_profile = true and p.show_on_leaderboard = true;

grant select on public.leaderboard to anon, authenticated;

-- Public player stats for profile pages. The view itself applies the visibility rules.
drop view if exists public.player_public_stats;
create view public.player_public_stats as
select
  p.id as user_id,
  s.state,
  s.favorites,
  case when p.show_team then s.team else '[]'::jsonb end as team,
  s.training
from public.profiles p
join public.player_saves s on s.user_id = p.id
where p.show_profile = true and p.show_in_players = true;

grant select on public.player_public_stats to anon, authenticated;
