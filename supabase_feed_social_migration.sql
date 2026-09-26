-- Cobblemon LivingDex V2 Social Feed — consolidated idempotent migration
-- Safe to run once even if the individual V2.0.16/V2.0.17 migrations were already run.

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,
  activity_user_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists activity_comments_activity_id_idx on public.activity_comments(activity_id, created_at);
create index if not exists activity_comments_activity_user_id_idx on public.activity_comments(activity_user_id);

alter table public.activity_comments enable row level security;
drop policy if exists "Feed comments are publicly readable" on public.activity_comments;
create policy "Feed comments are publicly readable" on public.activity_comments for select to anon, authenticated using (true);
drop policy if exists "Users can post Feed comments" on public.activity_comments;
create policy "Users can post Feed comments" on public.activity_comments for insert to authenticated with check (auth.uid() = user_id and char_length(trim(body)) between 1 and 280);
drop policy if exists "Users can delete their Feed comments" on public.activity_comments;
create policy "Users can delete their Feed comments" on public.activity_comments for delete to authenticated using (auth.uid() = user_id);
grant select on public.activity_comments to anon, authenticated;
grant insert, delete on public.activity_comments to authenticated;

create table if not exists public.activity_reactions (
  activity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('love','fire','clap','laugh','hundred')),
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index if not exists activity_reactions_activity_id_idx on public.activity_reactions(activity_id);

alter table public.activity_reactions enable row level security;
drop policy if exists "Feed reactions are publicly readable" on public.activity_reactions;
create policy "Feed reactions are publicly readable" on public.activity_reactions for select to anon, authenticated using (true);
drop policy if exists "Users can manage their Feed reaction" on public.activity_reactions;
create policy "Users can manage their Feed reaction" on public.activity_reactions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and reaction in ('love','fire','clap','laugh','hundred'));
grant select on public.activity_reactions to anon, authenticated;
grant insert, update, delete on public.activity_reactions to authenticated;
