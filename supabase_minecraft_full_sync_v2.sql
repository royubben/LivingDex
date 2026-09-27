-- Cobblemon LivingDex V2.5 basis — Minecraft full sync
-- Run AFTER supabase_minecraft_bridge_v1.sql and the existing V2.0.x trade migrations.
-- Minecraft is the source of truth for server-originated catches, evolutions and trades.
-- This migration intentionally keeps the existing V2.5 JSON save structure:
--   player_saves.state
--   player_saves.training.__pokemonCounts
--   player_saves.training.__shinies
--   player_saves.training.__activity
--   player_saves.training.__journey

create extension if not exists pgcrypto;

create table if not exists public.minecraft_bridge_events (
  event_id uuid primary key,
  event_type text not null,
  player_uuid uuid,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);
create index if not exists minecraft_bridge_events_type_idx on public.minecraft_bridge_events(event_type, processed_at desc);
revoke all on public.minecraft_bridge_events from anon, authenticated;

create table if not exists public.minecraft_trade_events (
  event_id uuid primary key references public.minecraft_bridge_events(event_id) on delete cascade,
  a_minecraft_uuid uuid not null,
  b_minecraft_uuid uuid not null,
  a_minecraft_name text not null default 'Unknown Player',
  b_minecraft_name text not null default 'Unknown Player',
  a_entry_id text not null,
  b_entry_id text not null,
  a_shiny boolean not null default false,
  b_shiny boolean not null default false,
  a_user_id uuid references public.profiles(id) on delete set null,
  b_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists minecraft_trade_events_users_idx on public.minecraft_trade_events(a_user_id,b_user_id,created_at desc);
create index if not exists minecraft_trade_events_created_idx on public.minecraft_trade_events(created_at desc);
revoke all on public.minecraft_trade_events from anon, authenticated;

create or replace function public._minecraft_json_inc(p_obj jsonb, p_key text, p_delta integer)
returns jsonb
language plpgsql
immutable
as $$
declare
  n integer := greatest(0, coalesce((p_obj->>p_key)::integer,0) + p_delta);
begin
  if n <= 0 then return p_obj - p_key; end if;
  return jsonb_set(coalesce(p_obj,'{}'::jsonb), array[p_key], to_jsonb(n), true);
end;
$$;
revoke all on function public._minecraft_json_inc(jsonb,text,integer) from public,anon,authenticated;


create or replace function public._minecraft_trim_activity(p_activity jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(x.value order by (x.value->>'ts')::bigint desc),'[]'::jsonb)
  from (
    select value
    from jsonb_array_elements(coalesce(p_activity,'[]'::jsonb))
    order by (value->>'ts')::bigint desc
    limit 1000
  ) x;
$$;
revoke all on function public._minecraft_trim_activity(jsonb) from public,anon,authenticated;

create or replace function public.ingest_minecraft_event(
  p_server_token text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_event uuid := nullif(p_payload->>'event_id','')::uuid;
  v_type text := coalesce(nullif(trim(p_payload->>'event_type'),''),'');
  v_player_uuid uuid;
  v_user uuid;
  v_name text;
  v_now_ms bigint := floor(extract(epoch from clock_timestamp()) * 1000);
  v_inserted integer;
  s public.player_saves%rowtype;
  state jsonb;
  training jsonb;
  counts jsonb;
  shinies jsonb;
  journey jsonb;
  activity jsonb;
  old_count integer;
  new_count integer;
  old_shiny integer;
  new_shiny integer;
  v_entry text;
  v_shiny boolean;
  v_from text;
  v_to text;
  v_from_shiny boolean;
  v_to_shiny boolean;
  v_pokemon_uuid text;
  v_a_uuid uuid;
  v_b_uuid uuid;
  v_a_user uuid;
  v_b_user uuid;
  v_a_name text;
  v_b_name text;
  v_a_display text;
  v_b_display text;
  v_a_entry text;
  v_b_entry text;
  v_a_shiny boolean;
  v_b_shiny boolean;
  trade_id uuid;
  activity_id text;
  a_save public.player_saves%rowtype;
  b_save public.player_saves%rowtype;
  state_a jsonb;
  state_b jsonb;
  training_a jsonb;
  training_b jsonb;
  counts_a jsonb;
  counts_b jsonb;
  shinies_a jsonb;
  shinies_b jsonb;
  journey_a jsonb;
  journey_b jsonb;
  activity_a jsonb;
  activity_b jsonb;
  a_old integer;
  b_old integer;
  a_shiny_old integer;
  b_shiny_old integer;
begin
  if p_server_token is null or p_server_token <> (select server_token from public.minecraft_bridge_config where id=1) then
    raise exception 'Invalid server token.';
  end if;
  if v_event is null then raise exception 'event_id is required.'; end if;
  if v_type not in ('cobblemon_catch','cobblemon_evolution','cobblemon_trade') then
    raise exception 'Unsupported Minecraft event type: %', v_type;
  end if;

  insert into public.minecraft_bridge_events(event_id,event_type,player_uuid,payload)
  values(v_event,v_type,nullif(p_payload->>'player_uuid','')::uuid,p_payload)
  on conflict(event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok',true,'duplicate',true,'event_id',v_event);
  end if;

  ---------------------------------------------------------------------------
  -- CATCH
  ---------------------------------------------------------------------------
  if v_type='cobblemon_catch' then
    v_player_uuid := nullif(p_payload->>'player_uuid','')::uuid;
    v_name := coalesce(nullif(trim(p_payload->>'player_name'),''),'Trainer');
    v_entry := nullif(trim(p_payload->>'pokemon_entry_id'),'');
    v_shiny := coalesce((p_payload->>'pokemon_shiny')::boolean,false);
    v_pokemon_uuid := nullif(trim(p_payload->>'pokemon_pokemon_uuid'),'');
    if v_player_uuid is null or v_entry is null then raise exception 'Minecraft catch payload is incomplete.'; end if;

    select id into v_user from public.profiles where minecraft_uuid=v_player_uuid;
    if v_user is null then
      return jsonb_build_object('ok',true,'unlinked',true,'event_id',v_event,'player_name',v_name);
    end if;

    insert into public.player_saves(user_id) values(v_user) on conflict(user_id) do nothing;
    select * into s from public.player_saves where user_id=v_user for update;
    state := coalesce(s.state,'{}'::jsonb);
    training := coalesce(s.training,'{}'::jsonb);
    counts := coalesce(training->'__pokemonCounts','{}'::jsonb);
    shinies := coalesce(training->'__shinies','{}'::jsonb);
    journey := coalesce(training->'__journey','{}'::jsonb);
    activity := coalesce(training->'__activity','[]'::jsonb);

    old_count := greatest(0,coalesce((counts->>v_entry)::integer,case when coalesce((state->>v_entry)::boolean,false) then 1 else 0 end));
    new_count := old_count + 1;
    state := jsonb_set(state,array[v_entry],'true'::jsonb,true);
    counts := jsonb_set(counts,array[v_entry],to_jsonb(new_count),true);
    if v_shiny then
      old_shiny := greatest(0,coalesce((shinies->>v_entry)::integer,0));
      new_shiny := old_shiny + 1;
      shinies := jsonb_set(shinies,array[v_entry],to_jsonb(new_shiny),true);
    end if;

    journey := jsonb_set(journey,array['owned',v_entry],jsonb_build_object(
      'obtainedMethod','minecraft_catch','obtainedAt',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'minecraftPokemonUuid',v_pokemon_uuid),true);
    activity := activity || jsonb_build_array(jsonb_build_object(
      'id','minecraft_catch_'||v_event::text,'ts',v_now_ms,'date',to_char(current_date,'YYYY-MM-DD'),
      'type','caught','entryId',v_entry,'name',v_entry,'shiny',v_shiny,'count',new_count,
      'obtainedMethod','minecraft_catch','source','minecraft','minecraftEventId',v_event::text));

    training := jsonb_set(jsonb_set(jsonb_set(training,'{__pokemonCounts}',counts,true),'{__shinies}',shinies,true),'{__journey}',journey,true);
    training := jsonb_set(training,'{__activity}',public._minecraft_trim_activity(activity),true);
    update public.player_saves set state=state,training=training,updated_at=clock_timestamp() where user_id=v_user;
    return jsonb_build_object('ok',true,'event_id',v_event,'user_id',v_user,'entry_id',v_entry,'shiny',v_shiny,'count',new_count);
  end if;

  ---------------------------------------------------------------------------
  -- EVOLUTION
  ---------------------------------------------------------------------------
  if v_type='cobblemon_evolution' then
    v_player_uuid := nullif(p_payload->>'player_uuid','')::uuid;
    v_name := coalesce(nullif(trim(p_payload->>'player_name'),''),'Trainer');
    v_from := nullif(trim(p_payload->>'from_entry_id'),'');
    v_to := nullif(trim(p_payload->>'to_entry_id'),'');
    v_from_shiny := coalesce((p_payload->>'from_shiny')::boolean,false);
    v_to_shiny := coalesce((p_payload->>'to_shiny')::boolean,v_from_shiny);
    v_pokemon_uuid := nullif(trim(p_payload->>'pokemon_uuid'),'');
    if v_player_uuid is null or v_from is null or v_to is null then raise exception 'Minecraft evolution payload is incomplete.'; end if;

    select id into v_user from public.profiles where minecraft_uuid=v_player_uuid;
    if v_user is null then
      return jsonb_build_object('ok',true,'unlinked',true,'event_id',v_event,'player_name',v_name);
    end if;

    insert into public.player_saves(user_id) values(v_user) on conflict(user_id) do nothing;
    select * into s from public.player_saves where user_id=v_user for update;
    state := coalesce(s.state,'{}'::jsonb);
    training := coalesce(s.training,'{}'::jsonb);
    counts := coalesce(training->'__pokemonCounts','{}'::jsonb);
    shinies := coalesce(training->'__shinies','{}'::jsonb);
    journey := coalesce(training->'__journey','{}'::jsonb);
    activity := coalesce(training->'__activity','[]'::jsonb);

    old_count := greatest(0,coalesce((counts->>v_from)::integer,case when coalesce((state->>v_from)::boolean,false) then 1 else 0 end));
    if old_count>0 then
      if old_count=1 then state := state-v_from; counts := counts-v_from;
      else counts := jsonb_set(counts,array[v_from],to_jsonb(old_count-1),true); end if;
    end if;
    new_count := greatest(0,coalesce((counts->>v_to)::integer,case when coalesce((state->>v_to)::boolean,false) then 1 else 0 end))+1;
    state := jsonb_set(state,array[v_to],'true'::jsonb,true);
    counts := jsonb_set(counts,array[v_to],to_jsonb(new_count),true);

    if v_from_shiny then
      old_shiny := greatest(0,coalesce((shinies->>v_from)::integer,0));
      if old_shiny>0 then
        if old_shiny=1 then shinies := shinies-v_from; else shinies := jsonb_set(shinies,array[v_from],to_jsonb(old_shiny-1),true); end if;
      end if;
    end if;
    if v_to_shiny then
      new_shiny := greatest(0,coalesce((shinies->>v_to)::integer,0))+1;
      shinies := jsonb_set(shinies,array[v_to],to_jsonb(new_shiny),true);
    end if;

    journey := jsonb_set(journey,'{owned}',coalesce(journey->'owned','{}'::jsonb)-v_from,true);
    journey := jsonb_set(journey,array['owned',v_to],jsonb_build_object(
      'obtainedMethod','minecraft_evolution','obtainedFrom',v_from,'obtainedAt',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'minecraftPokemonUuid',v_pokemon_uuid),true);
    activity := activity || jsonb_build_array(jsonb_build_object(
      'id','minecraft_evolution_'||v_event::text,'ts',v_now_ms,'date',to_char(current_date,'YYYY-MM-DD'),
      'type','evolved','entryId',v_to,'name',v_to,'sourceEntryId',v_from,'sourceName',v_from,
      'shiny',v_to_shiny,'sourceShiny',v_from_shiny,'source','minecraft','minecraftEventId',v_event::text));

    training := jsonb_set(jsonb_set(jsonb_set(training,'{__pokemonCounts}',counts,true),'{__shinies}',shinies,true),'{__journey}',journey,true);
    training := jsonb_set(training,'{__activity}',public._minecraft_trim_activity(activity),true);
    update public.player_saves set state=state,training=training,updated_at=clock_timestamp() where user_id=v_user;
    return jsonb_build_object('ok',true,'event_id',v_event,'user_id',v_user,'from_entry_id',v_from,'to_entry_id',v_to);
  end if;

  ---------------------------------------------------------------------------
  -- COMPLETED TRADE
  ---------------------------------------------------------------------------
  v_a_uuid := nullif(p_payload->>'a_uuid','')::uuid;
  v_b_uuid := nullif(p_payload->>'b_uuid','')::uuid;
  v_a_name := coalesce(nullif(trim(p_payload->>'a_name'),''),'Unknown Player');
  v_b_name := coalesce(nullif(trim(p_payload->>'b_name'),''),'Unknown Player');
  v_a_entry := nullif(trim(p_payload->>'a_entry_id'),'');
  v_b_entry := nullif(trim(p_payload->>'b_entry_id'),'');
  v_a_shiny := coalesce((p_payload->>'a_shiny')::boolean,false);
  v_b_shiny := coalesce((p_payload->>'b_shiny')::boolean,false);
  if v_a_uuid is null or v_b_uuid is null or v_a_entry is null or v_b_entry is null then raise exception 'Minecraft trade payload is incomplete or a Pokémon form is not mapped.'; end if;
  if v_a_uuid=v_b_uuid then raise exception 'Minecraft trade participants must be different.'; end if;

  select id,display_name into v_a_user,v_a_display from public.profiles where minecraft_uuid=v_a_uuid;
  select id,display_name into v_b_user,v_b_display from public.profiles where minecraft_uuid=v_b_uuid;
  v_a_display := coalesce(nullif(v_a_display,''),case when v_a_user is null then 'Unknown Player' else v_a_name end);
  v_b_display := coalesce(nullif(v_b_display,''),case when v_b_user is null then 'Unknown Player' else v_b_name end);

  insert into public.minecraft_trade_events(event_id,a_minecraft_uuid,b_minecraft_uuid,a_minecraft_name,b_minecraft_name,a_entry_id,b_entry_id,a_shiny,b_shiny,a_user_id,b_user_id)
  values(v_event,v_a_uuid,v_b_uuid,v_a_name,v_b_name,v_a_entry,v_b_entry,v_a_shiny,v_b_shiny,v_a_user,v_b_user);

  -- Lock the linked saves in UUID order. Missing saves are created first.
  if v_a_user is not null then insert into public.player_saves(user_id) values(v_a_user) on conflict(user_id) do nothing; end if;
  if v_b_user is not null then insert into public.player_saves(user_id) values(v_b_user) on conflict(user_id) do nothing; end if;
  if v_a_user is not null and v_b_user is not null then
    if v_a_user < v_b_user then
      select * into a_save from public.player_saves where user_id=v_a_user for update;
      select * into b_save from public.player_saves where user_id=v_b_user for update;
    else
      select * into b_save from public.player_saves where user_id=v_b_user for update;
      select * into a_save from public.player_saves where user_id=v_a_user for update;
    end if;
  elsif v_a_user is not null then
    select * into a_save from public.player_saves where user_id=v_a_user for update;
  elsif v_b_user is not null then
    select * into b_save from public.player_saves where user_id=v_b_user for update;
  end if;

  -- A: send A's Pokémon, receive B's Pokémon.
  if v_a_user is not null then
    state_a := coalesce(a_save.state,'{}'::jsonb); training_a := coalesce(a_save.training,'{}'::jsonb);
    counts_a := coalesce(training_a->'__pokemonCounts','{}'::jsonb); shinies_a := coalesce(training_a->'__shinies','{}'::jsonb);
    journey_a := coalesce(training_a->'__journey','{}'::jsonb); activity_a := coalesce(training_a->'__activity','[]'::jsonb);

    a_old := greatest(0,coalesce((counts_a->>v_a_entry)::integer,case when coalesce((state_a->>v_a_entry)::boolean,false) then 1 else 0 end));
    if a_old>0 then
      if a_old=1 then state_a:=state_a-v_a_entry; counts_a:=counts_a-v_a_entry; journey_a:=jsonb_set(journey_a,'{owned}',coalesce(journey_a->'owned','{}'::jsonb)-v_a_entry,true); else counts_a:=jsonb_set(counts_a,array[v_a_entry],to_jsonb(a_old-1),true); end if;
    end if;
    if v_a_shiny then
      a_shiny_old := greatest(0,coalesce((shinies_a->>v_a_entry)::integer,0));
      if a_shiny_old>0 then if a_shiny_old=1 then shinies_a:=shinies_a-v_a_entry; else shinies_a:=jsonb_set(shinies_a,array[v_a_entry],to_jsonb(a_shiny_old-1),true); end if; end if;
    end if;

    state_a:=jsonb_set(state_a,array[v_b_entry],'true'::jsonb,true);
    counts_a:=jsonb_set(counts_a,array[v_b_entry],to_jsonb(greatest(1,coalesce((counts_a->>v_b_entry)::integer,0)+1)),true);
    if v_b_shiny then shinies_a:=jsonb_set(shinies_a,array[v_b_entry],to_jsonb(greatest(1,coalesce((shinies_a->>v_b_entry)::integer,0)+1)),true); end if;
    journey_a:=jsonb_set(journey_a,array['owned',v_b_entry],jsonb_build_object('obtainedMethod','minecraft_trade','obtainedFrom',v_a_entry,'obtainedAt',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'tradePartnerName',v_b_display),true);
    activity_id:='minecraft_trade_'||v_event::text||'_a';
    activity_a:=activity_a||jsonb_build_array(jsonb_build_object('id',activity_id,'ts',v_now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded','entryId',v_b_entry,'name',v_b_entry,'shiny',v_b_shiny,'sourceEntryId',v_a_entry,'sourceName',v_a_entry,'sourceShiny',v_a_shiny,'tradePartnerId',v_b_user,'tradePartnerName',v_b_display,'linkedTradeId',v_event::text,'source','minecraft','minecraftEventId',v_event::text));
    training_a:=jsonb_set(jsonb_set(jsonb_set(training_a,'{__pokemonCounts}',counts_a,true),'{__shinies}',shinies_a,true),'{__journey}',journey_a,true);
    training_a:=jsonb_set(training_a,'{__activity}',public._minecraft_trim_activity(activity_a),true);
    update public.player_saves set state=state_a,training=training_a,updated_at=clock_timestamp() where user_id=v_a_user;
  end if;

  -- B: send B's Pokémon, receive A's Pokémon.
  if v_b_user is not null then
    state_b := coalesce(b_save.state,'{}'::jsonb); training_b := coalesce(b_save.training,'{}'::jsonb);
    counts_b := coalesce(training_b->'__pokemonCounts','{}'::jsonb); shinies_b := coalesce(training_b->'__shinies','{}'::jsonb);
    journey_b := coalesce(training_b->'__journey','{}'::jsonb); activity_b := coalesce(training_b->'__activity','[]'::jsonb);

    b_old := greatest(0,coalesce((counts_b->>v_b_entry)::integer,case when coalesce((state_b->>v_b_entry)::boolean,false) then 1 else 0 end));
    if b_old>0 then
      if b_old=1 then state_b:=state_b-v_b_entry; counts_b:=counts_b-v_b_entry; journey_b:=jsonb_set(journey_b,'{owned}',coalesce(journey_b->'owned','{}'::jsonb)-v_b_entry,true); else counts_b:=jsonb_set(counts_b,array[v_b_entry],to_jsonb(b_old-1),true); end if;
    end if;
    if v_b_shiny then
      b_shiny_old := greatest(0,coalesce((shinies_b->>v_b_entry)::integer,0));
      if b_shiny_old>0 then if b_shiny_old=1 then shinies_b:=shinies_b-v_b_entry; else shinies_b:=jsonb_set(shinies_b,array[v_b_entry],to_jsonb(b_shiny_old-1),true); end if; end if;
    end if;

    state_b:=jsonb_set(state_b,array[v_a_entry],'true'::jsonb,true);
    counts_b:=jsonb_set(counts_b,array[v_a_entry],to_jsonb(greatest(1,coalesce((counts_b->>v_a_entry)::integer,0)+1)),true);
    if v_a_shiny then shinies_b:=jsonb_set(shinies_b,array[v_a_entry],to_jsonb(greatest(1,coalesce((shinies_b->>v_a_entry)::integer,0)+1)),true); end if;
    journey_b:=jsonb_set(journey_b,array['owned',v_a_entry],jsonb_build_object('obtainedMethod','minecraft_trade','obtainedFrom',v_b_entry,'obtainedAt',to_char(clock_timestamp(),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'tradePartnerName',v_a_display),true);
    activity_id:='minecraft_trade_'||v_event::text||'_b';
    activity_b:=activity_b||jsonb_build_array(jsonb_build_object('id',activity_id,'ts',v_now_ms,'date',to_char(current_date,'YYYY-MM-DD'),'type','traded','entryId',v_a_entry,'name',v_a_entry,'shiny',v_a_shiny,'sourceEntryId',v_b_entry,'sourceName',v_b_entry,'sourceShiny',v_b_shiny,'tradePartnerId',v_a_user,'tradePartnerName',v_a_display,'linkedTradeId',v_event::text,'source','minecraft','minecraftEventId',v_event::text));
    training_b:=jsonb_set(jsonb_set(jsonb_set(training_b,'{__pokemonCounts}',counts_b,true),'{__shinies}',shinies_b,true),'{__journey}',journey_b,true);
    training_b:=jsonb_set(training_b,'{__activity}',public._minecraft_trim_activity(activity_b),true);
    update public.player_saves set state=state_b,training=training_b,updated_at=clock_timestamp() where user_id=v_b_user;
  end if;

  -- Keep the existing website trade history compatible when both participants are linked.
  if v_a_user is not null and v_b_user is not null then
    insert into public.trainer_trades(from_user_id,to_user_id,from_pokemon,to_pokemon,from_trainer_name,to_trainer_name,status,source,minecraft_event_id)
    values(v_a_user,v_b_user,case when v_a_shiny then 'shiny:'||v_a_entry else v_a_entry end,case when v_b_shiny then 'shiny:'||v_b_entry else v_b_entry end,v_a_display,v_b_display,'accepted','minecraft',v_event)
    on conflict (minecraft_event_id) do nothing
    returning id into trade_id;
    if trade_id is null then select id into trade_id from public.trainer_trades where minecraft_event_id=v_event; end if;
  end if;

  if v_a_user is not null then
    insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
    values(v_a_user,'minecraft_trade',v_b_user, v_b_display,'Minecraft trade completed',v_a_display||' and '||v_b_display||' just completed a Minecraft trade.',trade_id);
  end if;
  if v_b_user is not null then
    insert into public.community_notifications(user_id,type,actor_id,actor_name,title,body,trainer_trade_id)
    values(v_b_user,'minecraft_trade',v_a_user, v_a_display,'Minecraft trade completed',v_a_display||' and '||v_b_display||' just completed a Minecraft trade.',trade_id);
  end if;

  return jsonb_build_object('ok',true,'event_id',v_event,'a_user_id',v_a_user,'b_user_id',v_b_user,'a_name',v_a_display,'b_name',v_b_display,'trade_id',trade_id);
end;
$$;

grant execute on function public.ingest_minecraft_event(text,jsonb) to anon,authenticated;

-- The server-only function is protected by the server token. The underlying event tables remain private.
