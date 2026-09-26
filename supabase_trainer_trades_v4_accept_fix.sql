-- Cobblemon LivingDex V2.0.32 — linked trade acceptance SQL fix
-- Run this as a NEW Supabase query after the previous trainer-trade migrations.
-- Fixes PostgreSQL aggregate/GROUP BY error during trade confirmation.

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
  trimmed_activity_a jsonb;
  trimmed_activity_b jsonb;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
begin
  select * into t
  from public.trainer_trades
  where id=p_trade_id and status='pending'
  for update;

  if not found then
    raise exception 'Trade is no longer pending.';
  end if;

  if auth.uid() <> t.to_user_id then
    raise exception 'Only the receiving trainer can confirm this trade.';
  end if;

  select * into a from public.player_saves where user_id=t.from_user_id for update;
  select * into b from public.player_saves where user_id=t.to_user_id for update;

  if a.user_id is null or b.user_id is null then
    raise exception 'One trainer does not have a saved collection yet.';
  end if;

  state_a := coalesce(a.state,'{}'::jsonb);
  state_b := coalesce(b.state,'{}'::jsonb);
  training_a := coalesce(a.training,'{}'::jsonb);
  training_b := coalesce(b.training,'{}'::jsonb);
  counts_a := coalesce(training_a->'__pokemonCounts','{}'::jsonb);
  counts_b := coalesce(training_b->'__pokemonCounts','{}'::jsonb);

  ca := greatest(0, coalesce((counts_a->>t.from_pokemon)::integer,
    case when coalesce((state_a->>t.from_pokemon)::boolean,false) then 1 else 0 end));
  cb := greatest(0, coalesce((counts_b->>t.to_pokemon)::integer,
    case when coalesce((state_b->>t.to_pokemon)::boolean,false) then 1 else 0 end));

  if ca < 1 then
    raise exception '% no longer owns %.', t.from_trainer_name, t.from_pokemon;
  end if;
  if cb < 1 then
    raise exception '% no longer owns %.', t.to_trainer_name, t.to_pokemon;
  end if;

  if ca=1 then
    state_a := state_a - t.from_pokemon;
    counts_a := counts_a - t.from_pokemon;
  else
    counts_a := jsonb_set(counts_a, array[t.from_pokemon], to_jsonb(ca-1), true);
  end if;

  if cb=1 then
    state_b := state_b - t.to_pokemon;
    counts_b := counts_b - t.to_pokemon;
  else
    counts_b := jsonb_set(counts_b, array[t.to_pokemon], to_jsonb(cb-1), true);
  end if;

  state_a := jsonb_set(state_a, array[t.to_pokemon], 'true'::jsonb, true);
  state_b := jsonb_set(state_b, array[t.from_pokemon], 'true'::jsonb, true);
  counts_a := jsonb_set(counts_a, array[t.to_pokemon], to_jsonb(greatest(1,coalesce((counts_a->>t.to_pokemon)::integer,0)+1)), true);
  counts_b := jsonb_set(counts_b, array[t.from_pokemon], to_jsonb(greatest(1,coalesce((counts_b->>t.from_pokemon)::integer,0)+1)), true);

  activity_a := coalesce(training_a->'__activity','[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id','trade_'||gen_random_uuid()::text,
      'ts',now_ms,
      'date',to_char(current_date,'YYYY-MM-DD'),
      'type','traded',
      'entryId',t.to_pokemon,
      'name',t.to_pokemon,
      'sourceEntryId',t.from_pokemon,
      'sourceName',t.from_pokemon,
      'tradePartnerId',t.to_user_id,
      'tradePartnerName',t.to_trainer_name,
      'linkedTradeId',t.id
    )
  );

  activity_b := coalesce(training_b->'__activity','[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'id','trade_'||gen_random_uuid()::text,
      'ts',now_ms,
      'date',to_char(current_date,'YYYY-MM-DD'),
      'type','traded',
      'entryId',t.from_pokemon,
      'name',t.from_pokemon,
      'sourceEntryId',t.to_pokemon,
      'sourceName',t.to_pokemon,
      'tradePartnerId',t.from_user_id,
      'tradePartnerName',t.from_trainer_name,
      'linkedTradeId',t.id
    )
  );

  -- LIMIT must be applied in a subquery before jsonb_agg. The previous
  -- version used LIMIT directly inside the aggregate expression, which
  -- caused PostgreSQL to report: x.value must appear in GROUP BY.
  select coalesce(jsonb_agg(q.value), '[]'::jsonb)
  into trimmed_activity_a
  from (
    select x.value
    from jsonb_array_elements(activity_a) as x(value)
    order by (x.value->>'ts')::bigint desc
    limit 1000
  ) q;

  select coalesce(jsonb_agg(q.value), '[]'::jsonb)
  into trimmed_activity_b
  from (
    select x.value
    from jsonb_array_elements(activity_b) as x(value)
    order by (x.value->>'ts')::bigint desc
    limit 1000
  ) q;

  training_a := jsonb_set(jsonb_set(training_a,'{__pokemonCounts}',counts_a,true),'{__activity}',trimmed_activity_a,true);
  training_b := jsonb_set(jsonb_set(training_b,'{__pokemonCounts}',counts_b,true),'{__activity}',trimmed_activity_b,true);

  update public.player_saves
  set state=state_a, training=training_a, updated_at=clock_timestamp()
  where user_id=t.from_user_id;

  update public.player_saves
  set state=state_b, training=training_b, updated_at=clock_timestamp()
  where user_id=t.to_user_id;

  update public.trainer_trades
  set status='accepted', updated_at=clock_timestamp()
  where id=t.id;

  insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
  values
    (t.from_user_id,'trainer_trade_accepted',t.to_user_id,t.to_trainer_name,
      'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id),
    (t.to_user_id,'trainer_trade_accepted',t.from_user_id,t.from_trainer_name,
      'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id);

  return jsonb_build_object(
    'ok',true,
    'id',t.id,
    'from_user_id',t.from_user_id,
    'to_user_id',t.to_user_id,
    'from_pokemon',t.from_pokemon,
    'to_pokemon',t.to_pokemon,
    'from_trainer_name',t.from_trainer_name,
    'to_trainer_name',t.to_trainer_name
  );
end;
$$;

grant execute on function public.accept_trainer_trade(uuid) to authenticated;
