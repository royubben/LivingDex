-- Cobblemon LivingDex V2.0.28 — linked Trainer Trades
-- Run as a NEW Supabase SQL query. Safe to rerun.

create table if not exists public.trainer_trades (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  from_pokemon text not null,
  to_pokemon text not null,
  from_trainer_name text not null default 'Trainer',
  to_trainer_name text not null default 'Trainer',
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_trades_users_different check (from_user_id <> to_user_id)
);
create index if not exists trainer_trades_to_idx on public.trainer_trades(to_user_id,status,created_at desc);
create index if not exists trainer_trades_from_idx on public.trainer_trades(from_user_id,status,created_at desc);
alter table public.trainer_trades enable row level security;
drop policy if exists "Trainer trades are visible to participants" on public.trainer_trades;
create policy "Trainer trades are visible to participants" on public.trainer_trades for select to authenticated using (auth.uid()=from_user_id or auth.uid()=to_user_id);
drop policy if exists "Trainers can create trades" on public.trainer_trades;
create policy "Trainers can create trades" on public.trainer_trades for insert to authenticated with check (auth.uid()=from_user_id and from_user_id<>to_user_id and status='pending');
drop policy if exists "Trade participants can cancel or decline" on public.trainer_trades;
create policy "Trade participants can cancel or decline" on public.trainer_trades for update to authenticated using (auth.uid()=from_user_id or auth.uid()=to_user_id) with check (auth.uid()=from_user_id or auth.uid()=to_user_id);
grant select,insert,update on public.trainer_trades to authenticated;

alter table public.community_notifications add column if not exists trainer_trade_id uuid references public.trainer_trades(id) on delete cascade;
create index if not exists community_notifications_trainer_trade_idx on public.community_notifications(trainer_trade_id);

create or replace function public.accept_trainer_trade(p_trade_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trainer_trades%rowtype;
  a public.player_saves%rowtype;
  b public.player_saves%rowtype;
  state_a jsonb;
  state_b jsonb;
  training_a jsonb;
  training_b jsonb;
  counts_a jsonb;
  counts_b jsonb;
  ca integer;
  cb integer;
  activity_a jsonb;
  activity_b jsonb;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  actor text;
begin
  select * into t from public.trainer_trades where id=p_trade_id and status='pending' for update;
  if not found then raise exception 'Trade is no longer pending.'; end if;
  if auth.uid() <> t.to_user_id then raise exception 'Only the receiving trainer can confirm this trade.'; end if;

  select * into a from public.player_saves where user_id=t.from_user_id for update;
  select * into b from public.player_saves where user_id=t.to_user_id for update;
  if a.user_id is null or b.user_id is null then raise exception 'One trainer does not have a saved collection yet.'; end if;

  state_a := coalesce(a.state,'{}'::jsonb); state_b := coalesce(b.state,'{}'::jsonb);
  training_a := coalesce(a.training,'{}'::jsonb); training_b := coalesce(b.training,'{}'::jsonb);
  counts_a := coalesce(training_a->'__pokemonCounts','{}'::jsonb); counts_b := coalesce(training_b->'__pokemonCounts','{}'::jsonb);

  ca := greatest(0, coalesce((counts_a->>t.from_pokemon)::integer, case when coalesce((state_a->>t.from_pokemon)::boolean,false) then 1 else 0 end));
  cb := greatest(0, coalesce((counts_b->>t.to_pokemon)::integer, case when coalesce((state_b->>t.to_pokemon)::boolean,false) then 1 else 0 end));
  if ca < 1 then raise exception '% no longer owns %.', t.from_trainer_name, t.from_pokemon; end if;
  if cb < 1 then raise exception '% no longer owns %.', t.to_trainer_name, t.to_pokemon; end if;

  if ca=1 then state_a := state_a - t.from_pokemon; counts_a := counts_a - t.from_pokemon; else counts_a := jsonb_set(counts_a, array[t.from_pokemon], to_jsonb(ca-1), true); end if;
  if cb=1 then state_b := state_b - t.to_pokemon; counts_b := counts_b - t.to_pokemon; else counts_b := jsonb_set(counts_b, array[t.to_pokemon], to_jsonb(cb-1), true); end if;

  state_a := jsonb_set(state_a, array[t.to_pokemon], 'true'::jsonb, true);
  state_b := jsonb_set(state_b, array[t.from_pokemon], 'true'::jsonb, true);
  counts_a := jsonb_set(counts_a, array[t.to_pokemon], to_jsonb(greatest(1,coalesce((counts_a->>t.to_pokemon)::integer,0)+1)), true);
  counts_b := jsonb_set(counts_b, array[t.from_pokemon], to_jsonb(greatest(1,coalesce((counts_b->>t.from_pokemon)::integer,0)+1)), true);

  activity_a := coalesce(training_a->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded','entryId',t.to_pokemon,'name',t.to_pokemon,'sourceEntryId',t.from_pokemon,'sourceName',t.from_pokemon,'tradePartnerId',t.to_user_id,'tradePartnerName',t.to_trainer_name,'linkedTradeId',t.id));
  activity_b := coalesce(training_b->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id','trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded','entryId',t.from_pokemon,'name',t.from_pokemon,'sourceEntryId',t.to_pokemon,'sourceName',t.to_pokemon,'tradePartnerId',t.from_user_id,'tradePartnerName',t.from_trainer_name,'linkedTradeId',t.id));
  training_a := jsonb_set(jsonb_set(training_a,'{__pokemonCounts}',counts_a,true),'{__activity}',to_jsonb((select jsonb_agg(x) from jsonb_array_elements(activity_a) x order by (x->>'ts')::bigint desc limit 1000)),true);
  training_b := jsonb_set(jsonb_set(training_b,'{__pokemonCounts}',counts_b,true),'{__activity}',to_jsonb((select jsonb_agg(x) from jsonb_array_elements(activity_b) x order by (x->>'ts')::bigint desc limit 1000)),true);

  update public.player_saves set state=state_a, training=training_a, updated_at=clock_timestamp() where user_id=t.from_user_id;
  update public.player_saves set state=state_b, training=training_b, updated_at=clock_timestamp() where user_id=t.to_user_id;
  update public.trainer_trades set status='accepted', updated_at=clock_timestamp() where id=t.id;

  insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
  values
    (t.from_user_id,'trainer_trade_accepted',t.to_user_id,t.to_trainer_name,'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id),
    (t.to_user_id,'trainer_trade_accepted',t.from_user_id,t.from_trainer_name,'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id);

  return jsonb_build_object('ok',true,'id',t.id,'from_user_id',t.from_user_id,'to_user_id',t.to_user_id,'from_pokemon',t.from_pokemon,'to_pokemon',t.to_pokemon,'from_trainer_name',t.from_trainer_name,'to_trainer_name',t.to_trainer_name);
end;
$$;

create or replace function public.respond_trainer_trade(p_trade_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare t public.trainer_trades%rowtype;
begin
  if p_status not in ('declined','cancelled') then raise exception 'Invalid trade response.'; end if;
  select * into t from public.trainer_trades where id=p_trade_id and status='pending' for update;
  if not found then raise exception 'Trade is no longer pending.'; end if;
  if auth.uid() <> t.to_user_id and auth.uid() <> t.from_user_id then raise exception 'Not a trade participant.'; end if;
  update public.trainer_trades set status=p_status,updated_at=clock_timestamp() where id=t.id;
  insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
  values (case when auth.uid()=t.to_user_id then t.from_user_id else t.to_user_id end,'trainer_trade_'||p_status,auth.uid(),case when auth.uid()=t.to_user_id then t.to_trainer_name else t.from_trainer_name end,'Trade request '||p_status,case when p_status='declined' then 'The proposed trade was declined.' else 'The proposed trade was cancelled.' end,t.id);
  return jsonb_build_object('ok',true,'status',p_status);
end;
$$;
grant execute on function public.accept_trainer_trade(uuid) to authenticated;
grant execute on function public.respond_trainer_trade(uuid,text) to authenticated;
