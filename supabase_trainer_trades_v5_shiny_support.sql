-- Cobblemon LivingDex V2.0.35 — shiny-aware linked trades
-- Run this AFTER the existing trainer-trade migrations.
-- Shiny assets are encoded as shiny:<pokemon_entry_id> in trainer_trades.
-- Normal Pokémon continue to use their regular entry id.

create or replace function public.create_trainer_trade(
  p_to_user_id uuid,
  p_from_pokemon text,
  p_to_pokemon text,
  p_from_trainer_name text,
  p_to_trainer_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_user_id uuid := auth.uid();
  v_trade_id uuid;
  v_to_name text;
  v_from_shiny boolean := left(trim(coalesce(p_from_pokemon,'')),6) = 'shiny:';
  v_to_shiny boolean := left(trim(coalesce(p_to_pokemon,'')),6) = 'shiny:';
  v_from_id text := case when v_from_shiny then substring(trim(p_from_pokemon) from 7) else trim(p_from_pokemon) end;
  v_to_id text := case when v_to_shiny then substring(trim(p_to_pokemon) from 7) else trim(p_to_pokemon) end;
begin
  if v_from_user_id is null then raise exception 'You must be signed in to create a trade.'; end if;
  if p_to_user_id is null or p_to_user_id = v_from_user_id then raise exception 'Choose another Trainer.'; end if;
  if nullif(v_from_id,'') is null or nullif(v_to_id,'') is null then raise exception 'Choose both Pokémon.'; end if;

  select display_name into v_to_name
  from public.profiles
  where id=p_to_user_id and show_profile=true and show_in_players=true;
  if not found then raise exception 'Trainer not found or not visible.'; end if;

  insert into public.trainer_trades(
    from_user_id,to_user_id,from_pokemon,to_pokemon,
    from_trainer_name,to_trainer_name,status
  ) values (
    v_from_user_id,p_to_user_id,
    case when v_from_shiny then 'shiny:'||v_from_id else v_from_id end,
    case when v_to_shiny then 'shiny:'||v_to_id else v_to_id end,
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer'),
    coalesce(nullif(trim(p_to_trainer_name),''),v_to_name,'Trainer'),
    'pending'
  ) returning id into v_trade_id;

  insert into public.community_notifications(
    user_id,type,actor_id,actor_name,title,body,trainer_trade_id
  ) values (
    p_to_user_id,
    'trainer_trade_request',
    v_from_user_id,
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer'),
    'New trade request',
    coalesce(nullif(trim(p_from_trainer_name),''),'Trainer')
      || ' wants to trade ' || case when v_from_shiny then 'a shiny Pokémon' else 'a Pokémon' end
      || ' for ' || case when v_to_shiny then 'a shiny Pokémon' else 'a Pokémon' end || '.',
    v_trade_id
  );

  return jsonb_build_object('ok',true,'id',v_trade_id,'to_user_id',p_to_user_id,
    'from_pokemon',case when v_from_shiny then 'shiny:'||v_from_id else v_from_id end,
    'to_pokemon',case when v_to_shiny then 'shiny:'||v_to_id else v_to_id end);
end;
$$;

grant execute on function public.create_trainer_trade(uuid,text,text,text,text) to authenticated;

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
  state_a jsonb; state_b jsonb;
  training_a jsonb; training_b jsonb;
  counts_a jsonb; counts_b jsonb;
  shinies_a jsonb; shinies_b jsonb;
  ca integer; cb integer;
  activity_a jsonb; activity_b jsonb;
  trimmed_activity_a jsonb; trimmed_activity_b jsonb;
  now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  from_shiny boolean;
  to_shiny boolean;
  from_id text;
  to_id text;
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
  shinies_a := coalesce(training_a->'__shinies','{}'::jsonb); shinies_b := coalesce(training_b->'__shinies','{}'::jsonb);

  from_shiny := left(t.from_pokemon,6)='shiny:';
  to_shiny := left(t.to_pokemon,6)='shiny:';
  from_id := case when from_shiny then substring(t.from_pokemon from 7) else t.from_pokemon end;
  to_id := case when to_shiny then substring(t.to_pokemon from 7) else t.to_pokemon end;

  ca := greatest(0, case when from_shiny
    then coalesce((shinies_a->>from_id)::integer,0)
    else coalesce((counts_a->>from_id)::integer,case when coalesce((state_a->>from_id)::boolean,false) then 1 else 0 end)
  end);
  cb := greatest(0, case when to_shiny
    then coalesce((shinies_b->>to_id)::integer,0)
    else coalesce((counts_b->>to_id)::integer,case when coalesce((state_b->>to_id)::boolean,false) then 1 else 0 end)
  end);

  if ca < 1 then raise exception '% no longer owns the offered Pokémon.',t.from_trainer_name; end if;
  if cb < 1 then raise exception '% no longer owns the offered Pokémon.',t.to_trainer_name; end if;

  -- Remove A's offered asset.
  if from_shiny then
    if ca=1 then shinies_a := shinies_a - from_id;
    else shinies_a := jsonb_set(shinies_a,array[from_id],to_jsonb(ca-1),true); end if;
  else
    if ca=1 then state_a := state_a - from_id; counts_a := counts_a - from_id;
    else counts_a := jsonb_set(counts_a,array[from_id],to_jsonb(ca-1),true); end if;
  end if;

  -- Remove B's offered asset.
  if to_shiny then
    if cb=1 then shinies_b := shinies_b - to_id;
    else shinies_b := jsonb_set(shinies_b,array[to_id],to_jsonb(cb-1),true); end if;
  else
    if cb=1 then state_b := state_b - to_id; counts_b := counts_b - to_id;
    else counts_b := jsonb_set(counts_b,array[to_id],to_jsonb(cb-1),true); end if;
  end if;

  -- Give B A's asset.
  if from_shiny then
    shinies_b := jsonb_set(shinies_b,array[from_id],to_jsonb(greatest(1,coalesce((shinies_b->>from_id)::integer,0)+1)),true);
  else
    state_b := jsonb_set(state_b,array[from_id],'true'::jsonb,true);
    counts_b := jsonb_set(counts_b,array[from_id],to_jsonb(greatest(1,coalesce((counts_b->>from_id)::integer,0)+1)),true);
  end if;

  -- Give A B's asset.
  if to_shiny then
    shinies_a := jsonb_set(shinies_a,array[to_id],to_jsonb(greatest(1,coalesce((shinies_a->>to_id)::integer,0)+1)),true);
  else
    state_a := jsonb_set(state_a,array[to_id],'true'::jsonb,true);
    counts_a := jsonb_set(counts_a,array[to_id],to_jsonb(greatest(1,coalesce((counts_a->>to_id)::integer,0)+1)),true);
  end if;

  activity_a := coalesce(training_a->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id','trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded',
    'entryId',to_id,'name',to_id,'shiny',to_shiny,
    'sourceEntryId',from_id,'sourceName',from_id,'sourceShiny',from_shiny,
    'tradePartnerId',t.to_user_id,'tradePartnerName',t.to_trainer_name,'linkedTradeId',t.id));

  activity_b := coalesce(training_b->'__activity','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id','trade_'||gen_random_uuid()::text,'ts',now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded',
    'entryId',from_id,'name',from_id,'shiny',from_shiny,
    'sourceEntryId',to_id,'sourceName',to_id,'sourceShiny',to_shiny,
    'tradePartnerId',t.from_user_id,'tradePartnerName',t.from_trainer_name,'linkedTradeId',t.id));

  select coalesce(jsonb_agg(q.value),'[]'::jsonb) into trimmed_activity_a from (
    select x.value from jsonb_array_elements(activity_a) x(value) order by (x.value->>'ts')::bigint desc limit 1000
  ) q;
  select coalesce(jsonb_agg(q.value),'[]'::jsonb) into trimmed_activity_b from (
    select x.value from jsonb_array_elements(activity_b) x(value) order by (x.value->>'ts')::bigint desc limit 1000
  ) q;

  training_a := jsonb_set(jsonb_set(jsonb_set(training_a,'{__pokemonCounts}',counts_a,true),'{__shinies}',shinies_a,true),'{__activity}',trimmed_activity_a,true);
  training_b := jsonb_set(jsonb_set(jsonb_set(training_b,'{__pokemonCounts}',counts_b,true),'{__shinies}',shinies_b,true),'{__activity}',trimmed_activity_b,true);

  update public.player_saves set state=state_a,training=training_a,updated_at=clock_timestamp() where user_id=t.from_user_id;
  update public.player_saves set state=state_b,training=training_b,updated_at=clock_timestamp() where user_id=t.to_user_id;
  update public.trainer_trades set status='accepted',updated_at=clock_timestamp() where id=t.id;

  insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id) values
    (t.from_user_id,'trainer_trade_accepted',t.to_user_id,t.to_trainer_name,'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id),
    (t.to_user_id,'trainer_trade_accepted',t.from_user_id,t.from_trainer_name,'Trade completed',t.from_trainer_name||' and '||t.to_trainer_name||' just had a trade.',t.id);

  return jsonb_build_object('ok',true,'id',t.id,'from_user_id',t.from_user_id,'to_user_id',t.to_user_id,
    'from_pokemon',t.from_pokemon,'to_pokemon',t.to_pokemon,'from_trainer_name',t.from_trainer_name,'to_trainer_name',t.to_trainer_name);
end;
$$;

grant execute on function public.accept_trainer_trade(uuid) to authenticated;
