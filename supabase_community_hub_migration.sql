-- Cobblemon LivingDex V2.0.20 Community Hub
-- Run as a NEW Supabase SQL query. Safe to rerun.

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null default 'Trainer',
  kind text not null check (kind in ('looking_for','trade_offer','discussion','trainer_post')),
  title text not null default '',
  body text not null check (char_length(trim(body)) between 1 and 1000),
  wanted_pokemon jsonb not null default '[]'::jsonb,
  offered_pokemon jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);
create index if not exists community_posts_user_idx on public.community_posts(user_id);
create index if not exists community_posts_kind_idx on public.community_posts(kind,created_at desc);
alter table public.community_posts enable row level security;
drop policy if exists "Community posts are publicly readable" on public.community_posts;
create policy "Community posts are publicly readable" on public.community_posts for select to anon, authenticated using (status='open');
drop policy if exists "Users can create community posts" on public.community_posts;
create policy "Users can create community posts" on public.community_posts for insert to authenticated with check (auth.uid()=user_id and char_length(trim(body)) between 1 and 1000);
drop policy if exists "Users can update their community posts" on public.community_posts;
create policy "Users can update their community posts" on public.community_posts for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Users can delete their community posts" on public.community_posts;
create policy "Users can delete their community posts" on public.community_posts for delete to authenticated using (auth.uid()=user_id);
grant select on public.community_posts to anon, authenticated;
grant insert,update,delete on public.community_posts to authenticated;

create table if not exists public.community_trade_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  post_owner_id uuid not null references auth.users(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null default 'Trainer',
  message text not null default '' check (char_length(message)<=500),
  wanted_pokemon jsonb not null default '[]'::jsonb,
  offered_pokemon jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_trade_requests_owner_idx on public.community_trade_requests(post_owner_id,status,created_at desc);
create index if not exists community_trade_requests_requester_idx on public.community_trade_requests(requester_id,status,created_at desc);
alter table public.community_trade_requests enable row level security;
drop policy if exists "Trade requests are visible to participants" on public.community_trade_requests;
create policy "Trade requests are visible to participants" on public.community_trade_requests for select to authenticated using (auth.uid()=post_owner_id or auth.uid()=requester_id);
drop policy if exists "Users can create trade requests" on public.community_trade_requests;
create policy "Users can create trade requests" on public.community_trade_requests for insert to authenticated with check (auth.uid()=requester_id and requester_id<>post_owner_id);
drop policy if exists "Post owners can respond to trade requests" on public.community_trade_requests;
create policy "Post owners can respond to trade requests" on public.community_trade_requests for update to authenticated using (auth.uid()=post_owner_id) with check (auth.uid()=post_owner_id);
drop policy if exists "Requesters can cancel trade requests" on public.community_trade_requests;
create policy "Requesters can cancel trade requests" on public.community_trade_requests for update to authenticated using (auth.uid()=requester_id) with check (auth.uid()=requester_id);
grant select,insert,update on public.community_trade_requests to authenticated;

create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default 'Trainer',
  post_id uuid references public.community_posts(id) on delete cascade,
  trade_request_id uuid references public.community_trade_requests(id) on delete cascade,
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists community_notifications_user_idx on public.community_notifications(user_id,read,created_at desc);
alter table public.community_notifications enable row level security;
drop policy if exists "Users can read their community notifications" on public.community_notifications;
create policy "Users can read their community notifications" on public.community_notifications for select to authenticated using (auth.uid()=user_id);
drop policy if exists "Users can mark their community notifications" on public.community_notifications;
create policy "Users can mark their community notifications" on public.community_notifications for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
grant select,update on public.community_notifications to authenticated;

-- Notifications are inserted by the authenticated client when a trade request is created/responded to.
grant insert on public.community_notifications to authenticated;
