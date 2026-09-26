-- Cobblemon LivingDex V2.0.30 — Trainer Trade Notification RLS Fix
-- Run this as a NEW Supabase query. Do not replace older migrations.

-- The original notification table granted INSERT but had no INSERT policy.
-- With RLS enabled, the grant alone is insufficient, so trainer trade
-- requests could be created successfully while their notification was rejected.

alter table public.community_notifications enable row level security;

 drop policy if exists "Authenticated users can create trade notifications" on public.community_notifications;
create policy "Authenticated users can create trade notifications"
on public.community_notifications
for insert to authenticated
with check (
  auth.uid() = actor_id
  and actor_id is not null
);

grant insert on public.community_notifications to authenticated;

-- V2.0.28/29 linked-trade column, made idempotent for databases that already have it.
alter table public.community_notifications
  add column if not exists trainer_trade_id uuid references public.trainer_trades(id) on delete cascade;

create index if not exists community_notifications_trainer_trade_idx
  on public.community_notifications(trainer_trade_id);
